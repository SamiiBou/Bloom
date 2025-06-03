const mongoose = require('mongoose');
const User = require('./src/models/User');

async function simulate3HoursPassed() {
  try {
    await mongoose.connect('mongodb://localhost:27017/tiktok-clone');
    console.log('🔗 Connected to MongoDB');
    
    // Trouver l'utilisateur (remplace 'samiii' par ton username si différent)
    const username = 'samiii';
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log(`❌ User "${username}" not found`);
      return;
    }
    
    console.log('\n📊 STATUS AVANT SIMULATION:');
    console.log('- Username:', user.username);
    console.log('- grabBalance:', user.grabBalance);
    console.log('- lastPeriodicTokenAt:', user.lastPeriodicTokenAt);
    console.log('- createdAt:', user.createdAt);
    
    // Simuler que 3 heures sont passées
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000 + 1000)); // 3h + 1 seconde
    
    // Si l'utilisateur n'a pas de lastPeriodicTokenAt, on simule qu'il a été créé il y a 3h
    const updateData = {
      lastPeriodicTokenAt: threeHoursAgo
    };
    
    await User.updateOne({ username }, { $set: updateData });
    
    console.log('\n🕒 SIMULATION APPLIQUÉE:');
    console.log('- lastPeriodicTokenAt mis à:', threeHoursAgo);
    console.log('- Cela simule que 3+ heures sont passées depuis le dernier token périodique');
    
    // Vérifier le résultat
    const updatedUser = await User.findOne({ username });
    console.log('\n📊 STATUS APRÈS SIMULATION:');
    console.log('- lastPeriodicTokenAt:', updatedUser.lastPeriodicTokenAt);
    console.log('- grabBalance (inchangé pour le moment):', updatedUser.grabBalance);
    
    console.log('\n✅ SIMULATION TERMINÉE!');
    console.log('\n🎯 PROCHAINES ÉTAPES:');
    console.log('1. Maintenant, va dans l\'app et clique sur "Claim" ou "Request Airdrop"');
    console.log('2. Tu devrais voir +1 token ajouté automatiquement à ton grabBalance');
    console.log('3. Vérifie les logs du serveur pour voir le message de crédit périodique');
    
  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Simuler plusieurs périodes (optionnel)
async function simulateMultiplePeriods(periods = 1) {
  try {
    await mongoose.connect('mongodb://localhost:27017/tiktok-clone');
    console.log('🔗 Connected to MongoDB');
    
    const username = 'samiii';
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log(`❌ User "${username}" not found`);
      return;
    }
    
    console.log(`\n📊 SIMULATION DE ${periods} PÉRIODES DE 3H:`);
    
    const now = new Date();
    const timeAgo = new Date(now.getTime() - (periods * 3 * 60 * 60 * 1000 + 1000));
    
    await User.updateOne({ username }, { 
      $set: { lastPeriodicTokenAt: timeAgo }
    });
    
    console.log(`✅ Simulé ${periods} x 3h passées`);
    console.log('- lastPeriodicTokenAt mis à:', timeAgo);
    console.log(`- Au prochain claim, tu devrais recevoir +${periods} tokens`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Fonction pour voir le status actuel
async function checkStatus() {
  try {
    await mongoose.connect('mongodb://localhost:27017/tiktok-clone');
    console.log('🔗 Connected to MongoDB');
    
    const username = 'samiii';
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log(`❌ User "${username}" not found`);
      return;
    }
    
    const now = new Date();
    const last = user.lastPeriodicTokenAt || user.createdAt;
    const periods = Math.floor((now - last) / (3 * 60 * 60 * 1000));
    
    console.log('\n📊 STATUS ACTUEL:');
    console.log('- Username:', user.username);
    console.log('- grabBalance:', user.grabBalance);
    console.log('- lastPeriodicTokenAt:', user.lastPeriodicTokenAt);
    console.log('- createdAt:', user.createdAt);
    console.log('- Maintenant:', now);
    console.log('- Périodes de 3h écoulées:', periods);
    console.log('- Tokens périodiques disponibles:', periods > 0 ? periods : 0);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Détecter quel script lancer selon les arguments
const args = process.argv.slice(2);

if (args.includes('status')) {
  checkStatus();
} else if (args.includes('multiple')) {
  const periods = parseInt(args[args.indexOf('multiple') + 1]) || 5;
  simulateMultiplePeriods(periods);
} else {
  simulate3HoursPassed();
} 