const mongoose = require('mongoose');

const imageCommentSchema = new mongoose.Schema(
  {
    /* ----- image associée ----- */
    image: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Image',
      required: true,
      index: true,
    },

    /* ----- auteur du commentaire ----- */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /* ----- contenu du commentaire ----- */
    content: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },

    /* ----- likes du commentaire ----- */
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    /* ----- réponses (commentaires imbriqués) ----- */
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageComment',
      default: null,
    },

    /* ----- statut ----- */
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* Virtuel pour le nombre de likes */
imageCommentSchema.virtual('likesCount').get(function () {
  return this.likes?.length || 0;
});

/* Index pour les performances */
imageCommentSchema.index({ image: 1, createdAt: -1 });
imageCommentSchema.index({ user: 1, createdAt: -1 });
imageCommentSchema.index({ parentComment: 1 });

module.exports = mongoose.model('ImageComment', imageCommentSchema); 