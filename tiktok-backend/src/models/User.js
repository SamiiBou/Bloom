const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
  },
  email: {
    type: String,
    sparse: true, // Permet les valeurs null/undefined
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't include password in queries by default
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters'],
  },
  bio: {
    type: String,
    maxlength: [160, 'Bio cannot exceed 160 characters'],
    default: '',
  },
  avatar: {
    type: String,
    default: '',
  },
  verified: {
    type: Boolean,
    default: false,
  },
  // Champ pour la vérification humaine World ID
  humanVerified: {
    type: Boolean,
    default: false,
  },
  humanVerifiedAt: {
    type: Date,
  },
  humanVerificationNullifier: {
    type: String,
    sparse: true,
  },
  // Nouveaux champs pour MiniKit/World App
  walletAddress: {
    type: String,
    sparse: true, // Permet les valeurs null/undefined
  },
  minikitUsername: {
    type: String,
    sparse: true,
  },
  minikitUserId: {
    type: String,
    sparse: true,
  },
  minikitProfilePicture: {
    type: String,
    default: '',
  },
  minikitVerificationLevel: {
    type: String,
    enum: ['orb', 'device', 'unverified'],
    default: 'unverified',
  },
  worldIdNullifierHash: {
    type: String,
    sparse: true,
  },
  authMethod: {
    type: String,
    enum: ['wallet', 'traditional', 'worldid'],
    default: 'traditional',
  },
  lastWalletSignature: {
    type: String,
    select: false,
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  followersCount: {
    type: Number,
    default: 0,
  },
  followingCount: {
    type: Number,
    default: 0,
  },
  videosCount: {
    type: Number,
    default: 0,
  },
  likesCount: {
    type: Number,
    default: 0,
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  // Champs pour l'airdrop de tokens
  claimPending: {
    amount: { type: Number },
    nonce: { type: String },
    txId: { type: String },
    createdAt: { type: Date }
  },
  lastClaimTime: {
    type: Date,
  },
  claimsHistory: [{
    amount: { type: Number, required: true },
    txHash: { type: String, required: true },
    at: { type: Date, default: Date.now }
  }],
  // Nouveau système de récompenses basé sur le visionnage
  grabBalance: {
    type: Number,
    default: 0
  },
  watchedVideos: [{
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
    section: { type: String, enum: ['home', 'videos'], required: true },
    tokensEarned: { type: Number, required: true },
    watchedAt: { type: Date, default: Date.now }
  }],
  // Système de crédits payants
  credits: {
    type: Number,
    default: 0
  },
  creditPurchaseHistory: [{
    amount: { type: Number, required: true }, // Nombre de crédits achetés
    wldPaid: { type: Number, required: true }, // Montant WLD payé
    transactionId: { type: String, required: true }, // ID de transaction World
    reference: { type: String, required: true }, // Référence du paiement
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    purchasedAt: { type: Date, default: Date.now }
  }],
}, {
  timestamps: true,
});

// Index personnalisés (sans duplication)
userSchema.index({ createdAt: -1 });
userSchema.index({ email: 1 }, { sparse: true, unique: true });
userSchema.index({ walletAddress: 1 }, { sparse: true, unique: true });
userSchema.index({ minikitUsername: 1 }, { sparse: true });

// Hash password before saving (seulement si password existe)
userSchema.pre('save', async function(next) {
  if (!this.password || !this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update followers count
userSchema.methods.updateFollowersCount = async function() {
  this.followersCount = this.followers.length;
  await this.save();
};

// Update following count
userSchema.methods.updateFollowingCount = async function() {
  this.followingCount = this.following.length;
  await this.save();
};

// Get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.lastWalletSignature;
  if (!userObject.email) delete userObject.email;
  return userObject;
};

// Nouvelle méthode pour obtenir les infos MiniKit
userSchema.methods.getMiniKitProfile = function() {
  return {
    walletAddress: this.walletAddress,
    minikitUsername: this.minikitUsername,
    minikitUserId: this.minikitUserId,
    minikitProfilePicture: this.minikitProfilePicture,
    minikitVerificationLevel: this.minikitVerificationLevel,
    authMethod: this.authMethod,
  };
};

module.exports = mongoose.model('User', userSchema); 