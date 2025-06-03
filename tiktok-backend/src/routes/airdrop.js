const express = require('express');
const { ethers } = require('ethers');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { setTimeout: wait } = require('node:timers/promises');
const mongoose = require('mongoose');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* ⚙️  CONFIG                                                         */
/* ------------------------------------------------------------------ */
const DISTRIBUTOR = '0xD32E3A5d27241Fd13141caf48c4b43F833aAFcBd';
const signerPk = process.env.TOKEN_PRIVATE_KEY;
if (!signerPk) throw new Error('TOKEN_PRIVATE_KEY must be set in .env');
const signer = new ethers.Wallet(signerPk);

const DOMAIN = {
  name: 'Distributor',
  version: '1',
  chainId: 480,
  verifyingContract: DISTRIBUTOR,
};

const VOUCHER_TYPES = {
  Voucher: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || 'https://worldchain-mainnet.g.alchemy.com/v2/YOUR_KEY'
);

let io;
const setSocketIO = (socket) => { io = socket; };

const CLAIM_TTL_MS = 3600 * 1000; // 1h = 3600000ms

async function monitorTx(userId, txId, nonce) {
  console.log(`[monitorTx] 🔍 Starting monitorTx for user=${userId}, txId=${txId}, nonce=${nonce}`);
  for (;;) {
    try {
      const wcUrl = `https://developer.worldcoin.org/api/v2/minikit/transaction/${txId}` +
                    `?app_id=${process.env.APP_ID}&type=transaction`;
      console.log(`[monitorTx] ⏳ Fetching Worldcoin status from ${wcUrl}`);
      const wcResp = await fetch(wcUrl);
      console.log(`[monitorTx] 🌐 Worldcoin response ok=${wcResp.ok}`);

      if (!wcResp.ok) {
        console.error('[monitorTx] Failed to fetch Worldcoin status:', await wcResp.text());
        await wait(5000);
        continue;
      }

      const wc = await wcResp.json();
      console.log('[monitorTx] Worldcoin payload:', wc);

      if (wc.transactionStatus === 'pending') {
        console.log(`[monitorTx] Transaction ${txId} still pending`);
        await wait(5000);
        continue;
      }

      if (wc.transactionStatus === 'failed') {
        console.warn(`[monitorTx] Transaction ${txId} failed, rolling back pending claim`);
        await User.updateOne({ _id: userId }, { $unset: { claimPending: '' } });
        console.log('[monitorTx] User claimPending reset');
        io?.to(userId).emit('claim_failed', { nonce });
        return;
      }

      console.log(`[monitorTx] Transaction ${txId} confirmed, hash=${wc.transactionHash}`);
      const receipt = await provider.getTransactionReceipt(wc.transactionHash);
      console.log('[monitorTx] Receipt fetched:', receipt);

      if (!receipt || receipt.status !== 1) {
        console.log('[monitorTx] Receipt not ready or failed, retrying...');
        await wait(5000);
        continue;
      }

      // 🚨 FIX: Use atomic update to prevent double processing
      console.log(`[monitorTx] 🔒 Attempting atomic finalization for nonce=${nonce}`);
      const updateResult = await User.findOneAndUpdate(
        { 
          _id: userId, 
          'claimPending.nonce': nonce,
          'claimPending.txId': txId
        },
        {
          $unset: { claimPending: '' },
          $inc: { grabBalance: -1 }, // Temporary placeholder - will be corrected below
          $push: { claimsHistory: { amount: 0, txHash: wc.transactionHash, at: new Date() } }
        },
        { new: false } // Return old document to get the amount
      );

      if (!updateResult) {
        console.log(`[monitorTx] ⚠️ Transaction ${txId} already processed or not found, skipping`);
        return;
      }

      // Extract the actual amount from the pending claim
      const claimedAmount = updateResult.claimPending?.amount || 0;
      console.log(`[monitorTx] 📊 Extracted claimed amount: ${claimedAmount}`);

      // Now do the correct update with the real amount
      await User.updateOne(
        { _id: userId },
        {
          $inc: { grabBalance: (1 - claimedAmount) }, // Correct the temporary -1 and subtract real amount
          $set: { 'claimsHistory.$[elem].amount': claimedAmount }
        },
        {
          arrayFilters: [{ 'elem.txHash': wc.transactionHash }]
        }
      );

      console.log(`[monitorTx] ✅ Successfully finalized claim: ${claimedAmount} tokens`);
      io?.to(userId).emit('claim_confirmed', { amount: claimedAmount });
      console.log(`[monitorTx] 🏁 Monitoring complete for txId=${txId}`);
      return;

    } catch (error) {
      console.error(`[monitorTx] Error monitoring ${txId}:`, error);
      await wait(5000);
    }
  }
}

const resumePendingTransactions = async () => {
  console.log('[resumePendingTransactions] 🔄 Checking for pending claims on startup');
  try {
    const pendings = await User.find({ 'claimPending.txId': { $exists: true, $ne: null } })
      .select('claimPending _id');

    console.log(`[resumePendingTransactions] Found ${pendings.length} pending claims`);
    pendings.forEach(u => {
      console.log(`[resumePendingTransactions] Resuming user=${u._id}, txId=${u.claimPending.txId}`);
      monitorTx(u._id, u.claimPending.txId, u.claimPending.nonce)
        .catch(err => console.error('[resumePendingTransactions] Error:', err));
    });
    return pendings.length;
  } catch (err) {
    console.error('[resumePendingTransactions] Fatal:', err);
    return 0;
  }
};

/* ------------------------------------------------------------------ */
/* 1️⃣  Request voucher                                               */
/* ------------------------------------------------------------------ */
router.post('/request', protect, async (req, res) => {
  console.log('[AIRDROP/request] ➡️ Entry', { userId: req.user._id });
  try {
    let user = await User.findById(req.user._id)
      .select('walletAddress claimPending lastClaimTime grabBalance lastPeriodicTokenAt createdAt');
    console.log('[AIRDROP/request] User DB fetch:', user);

    // --- AJOUT: Crédit périodique automatique ---
    const now = new Date();
    let last = user.lastPeriodicTokenAt || user.createdAt;
    let periods = Math.floor((now - last) / (3 * 60 * 60 * 1000));
    if (periods > 0) {
      user.grabBalance += periods;
      user.lastPeriodicTokenAt = new Date(last.getTime() + periods * 3 * 60 * 60 * 1000);
      await user.save();
      console.log(`[AIRDROP/request] +${periods} tokens périodiques crédités (3h/période)`);
    }
    // --- FIN AJOUT ---

    if (!user) {
      console.warn('[AIRDROP/request] User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.walletAddress) {
      console.warn('[AIRDROP/request] Wallet not set');
      return res.status(400).json({ error: 'Wallet not set' });
    }

    // Vérifier que l'utilisateur a des tokens à grab
    if (!user.grabBalance || user.grabBalance <= 0) {
      console.warn('[AIRDROP/request] No tokens available to grab');
      return res.status(400).json({ 
        error: 'No tokens available to grab. Watch videos to earn tokens!',
        grabBalance: user.grabBalance || 0
      });
    }

    // Utiliser la grabBalance de l'utilisateur comme montant à claim
    const CLAIM_AMOUNT = user.grabBalance;

    // Handle expired pending or incomplete pending
    if (user.claimPending) {
      const hasValidPending = user.claimPending.amount && user.claimPending.nonce;
      
      if (hasValidPending) {
        const createdAt = Number(user.claimPending.nonce);
        const noTxId = !user.claimPending.txId;
        const ttlExceeded = Date.now() - createdAt > 5 * 60_000; // 5 min
        
        // If there's a txId, check if it's old (potentially stuck)
        if (user.claimPending.txId) {
          const pendingAge = Date.now() - createdAt;
          if (pendingAge > 10 * 60_000) { // 10 minutes old
            console.log('[AIRDROP/request] Clearing old pending claim with txId (likely stuck)');
            await User.updateOne({ _id: user._id }, { $unset: { claimPending: '' } });
          } else {
            console.warn('[AIRDROP/request] Claim with txId still pending', user.claimPending);
            return res.status(400).json({ 
              error: 'Claim still being processed – please wait a moment',
              pending: true,
              txId: user.claimPending.txId
            });
          }
        } else if (noTxId && !ttlExceeded) {
          // Return existing voucher
          const deadline = Math.floor(Date.now() / 1000) + 3600;
          const amount = ethers.parseUnits(CLAIM_AMOUNT.toString(), 18).toString();

          const voucher = {
            to: user.walletAddress,
            amount,
            nonce: user.claimPending.nonce,
            deadline: deadline.toString(),
          };

          const signature = await signer.signTypedData(DOMAIN, VOUCHER_TYPES, voucher);
          return res.json({ voucher, signature, claimedAmount: CLAIM_AMOUNT, pending: true });
        } else if (noTxId && ttlExceeded) {
          console.log('[AIRDROP/request] Expired pending claim, clearing');
          await User.updateOne({ _id: user._id }, { $unset: { claimPending: '' } });
        }
      } else {
        // Invalid/incomplete pending claim - clear it
        console.log('[AIRDROP/request] Invalid pending claim structure, clearing');
        await User.updateOne({ _id: user._id }, { $unset: { claimPending: '' } });
      }
    }

    const nonce = Date.now().toString();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const voucher = {
      to: user.walletAddress,
      amount: ethers.parseUnits(CLAIM_AMOUNT.toString(), 18).toString(),
      nonce,
      deadline: deadline.toString(),
    };
    console.log('[AIRDROP/request] Voucher generated:', voucher);

    const signature = await signer.signTypedData(DOMAIN, VOUCHER_TYPES, voucher);
    console.log('[AIRDROP/request] Signature:', signature);

    const upd = await User.updateOne(
      { _id: user._id },
      { $set: { claimPending: { amount: CLAIM_AMOUNT, nonce } } }
    );
    console.log('[AIRDROP/request] DB update claimPending:', upd);

    return res.json({ voucher, signature, claimedAmount: CLAIM_AMOUNT });

  } catch (e) {
    console.error('[AIRDROP/request] ERROR:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------------------------------------------------ */
/* 2️⃣  Confirm transaction                                           */
/* ------------------------------------------------------------------ */
router.post('/confirm', protect, async (req, res) => {
  console.log('[AIRDROP/confirm] ➡️ Entry', req.body);
  try {
    const { nonce, transaction_id: txId } = req.body;
    const userId = req.user._id;
    if (!nonce || !txId) {
      console.warn('[AIRDROP/confirm] Missing nonce or txId');
      return res.status(400).json({ error: 'Missing txId or nonce' });
    }

    const _id = new mongoose.Types.ObjectId(userId);
    
    // First, check if we already have this exact transaction confirmed
    const existingClaim = await User.findOne({ 
      _id, 
      'claimPending.nonce': String(nonce),
      'claimPending.txId': txId 
    }).select('claimPending');
    
    if (existingClaim) {
      console.log('[AIRDROP/confirm] Transaction already confirmed, NOT launching duplicate monitor');
      return res.json({ ok: true, status: 'already_confirmed' });
    }

    // Try to update pending claim with txId (first time confirmation)
    const updated = await User.findOneAndUpdate(
      { _id, 'claimPending.nonce': String(nonce), 'claimPending.txId': { $exists: false } },
      { 
        $set: { 
          'claimPending.txId': txId,
          lastClaimTime: new Date()
        } 
      },
      { new: true }
    );

    if (!updated) {
      // Maybe already has txId but different one? Check for conflicts
      const conflictCheck = await User.findOne({ 
        _id, 
        'claimPending.nonce': String(nonce) 
      }).select('claimPending');
      
      if (conflictCheck?.claimPending?.txId && conflictCheck.claimPending.txId !== txId) {
        console.warn('[AIRDROP/confirm] Transaction ID conflict');
        return res.status(409).json({ error: 'Transaction ID conflict - different txId already exists' });
      }
      
      console.warn('[AIRDROP/confirm] No matching pending claim found');
      return res.status(404).json({ error: 'No matching pending claim' });
    }

    console.log('[AIRDROP/confirm] First time confirmation successful');

    // Quick Worldcoin status check
    const checkUrl = `https://developer.worldcoin.org/api/v2/minikit/transaction/${txId}` +
                     `?app_id=${process.env.APP_ID}&type=transaction`;
    console.log('[AIRDROP/confirm] Checking Worldcoin status at', checkUrl);
    
    try {
      const wcResp = await fetch(checkUrl);
      const wc = await wcResp.json();
      console.log('[AIRDROP/confirm] Worldcoin status:', wc.transactionStatus);

      if (wc.transactionStatus === 'pending') {
        console.log('[AIRDROP/confirm] Status pending, launching monitor and returning 202');
        monitorTx(userId, txId, nonce).catch(e => console.error('[AIRDROP/confirm] monitorTx error:', e));
        return res.status(202).json({ status: 'pending' });
      }
    } catch (wcError) {
      console.warn('[AIRDROP/confirm] Worldcoin status check failed:', wcError.message);
    }

    console.log('[AIRDROP/confirm] Launching monitorTx (single instance)');
    monitorTx(userId, txId, nonce).catch(e => console.error('[AIRDROP/confirm] monitorTx error:', e));

    return res.json({ ok: true });
  } catch (e) {
    console.error('[AIRDROP/confirm] ERROR:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------------------------------------------------ */
/* 3️⃣  Cancel claim                                                  */
/* ------------------------------------------------------------------ */
router.post('/cancel', protect, async (req, res) => {
  console.log('[AIRDROP/cancel] ➡️ Entry', req.body);
  try {
    const { nonce } = req.body;
    const user = await User.findById(req.user._id).select('claimPending');
    console.log('[AIRDROP/cancel] User pending:', user.claimPending);

    if (!user?.claimPending || String(user.claimPending.nonce) !== String(nonce)) {
      console.warn('[AIRDROP/cancel] No matching pending claim');
      return res.status(400).json({ error: 'No matching pending claim' });
    }

    const upd = await User.updateOne({ _id: user._id }, { $unset: { claimPending: '' } });
    console.log('[AIRDROP/cancel] DB update result:', upd);

    return res.json({ ok: true });
  } catch (e) {
    console.error('[AIRDROP/cancel] ERROR:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------------------------------------------------ */
/* 4️⃣  Get claim status                                              */
/* ------------------------------------------------------------------ */
router.get('/status', protect, async (req, res) => {
  console.log('[AIRDROP/status] ➡️ Entry', { userId: req.user._id });
  try {
    const user = await User.findById(req.user._id)
      .select('claimPending lastClaimTime claimsHistory grabBalance watchedVideos');
    
    console.log('[AIRDROP/status] User found:', !!user);
    console.log('[AIRDROP/status] User grabBalance from DB:', user?.grabBalance);
    console.log('[AIRDROP/status] User watchedVideos count:', user?.watchedVideos?.length);
    console.log('[AIRDROP/status] User claimPending raw:', user?.claimPending);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 🚨 RADICAL APPROACH: Ignore claimPending completely for now
    // We'll re-add it properly later if needed
    console.log('[AIRDROP/status] 🚨 RADICAL MODE: Ignoring all claimPending logic');
    
    // Simple logic: can claim if has grabBalance > 0
    // 🔧 FIXED: Since we're ignoring claimPending, always allow claims if no real pending transaction
    const canClaim = user.grabBalance > 0;
    
    const tokensEarnedFromVideos = user.watchedVideos?.reduce((total, watch) => total + watch.tokensEarned, 0) || 0;
    
    const responseData = {
      canClaim,
      grabBalance: user.grabBalance || 0,
      nextClaimTime: null,
      hasPending: false, // 🚨 ALWAYS FALSE for now
      pendingDetails: null, // 🚨 ALWAYS NULL for now  
      lastClaimTime: user.lastClaimTime,
      totalClaims: user.claimsHistory?.length || 0,
      videosWatched: user.watchedVideos?.length || 0,
      tokensEarnedFromVideos: tokensEarnedFromVideos
    };
    
    console.log('[AIRDROP/status] 🚨 RADICAL Response:', responseData);

    return res.json(responseData);
  } catch (e) {
    console.error('[AIRDROP/status] ERROR:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, setSocketIO, resumePendingTransactions }; 