#!/bin/bash

# Script de démarrage rapide pour tester l'application TikTok Clone
# Usage: ./start-tests.sh

echo "🚀 TikTok Clone - Script de Test Automatique"
echo "=============================================="

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages colorés
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier si nous sommes dans le bon répertoire
if [ ! -d "tiktok-backend" ] || [ ! -d "tiktok-app" ]; then
    log_error "Ce script doit être exécuté depuis le répertoire racine contenant tiktok-backend et tiktok-app"
    exit 1
fi

log_info "Vérification des prérequis..."

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé"
    exit 1
fi
log_success "Node.js trouvé: $(node --version)"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    log_error "npm n'est pas installé"
    exit 1
fi
log_success "npm trouvé: $(npm --version)"

# Vérifier MongoDB (optionnel)
if command -v mongod &> /dev/null; then
    log_success "MongoDB trouvé"
else
    log_warning "MongoDB non trouvé localement (vous pouvez utiliser MongoDB Atlas)"
fi

echo ""
log_info "Installation des dépendances..."

# Installer les dépendances du backend
cd tiktok-backend
if [ ! -d "node_modules" ]; then
    log_info "Installation des dépendances backend..."
    npm install
    if [ $? -eq 0 ]; then
        log_success "Dépendances backend installées"
    else
        log_error "Échec de l'installation des dépendances backend"
        exit 1
    fi
else
    log_success "Dépendances backend déjà installées"
fi

# Installer les dépendances du frontend
cd ../tiktok-app
if [ ! -d "node_modules" ]; then
    log_info "Installation des dépendances frontend..."
    npm install
    if [ $? -eq 0 ]; then
        log_success "Dépendances frontend installées"
    else
        log_error "Échec de l'installation des dépendances frontend"
        exit 1
    fi
else
    log_success "Dépendances frontend déjà installées"
fi

cd ..

echo ""
log_info "Vérification des fichiers de configuration..."

# Vérifier le fichier .env du backend
if [ ! -f "tiktok-backend/.env" ]; then
    log_warning "Fichier .env manquant dans tiktok-backend/"
    log_info "Création d'un fichier .env d'exemple..."
    
    cat > tiktok-backend/.env << EOF
# Database
MONGODB_URI=mongodb://localhost:27017/tiktok-clone

# JWT
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-secure-$(date +%s)
JWT_EXPIRE=7d

# AWS S3 Configuration (À CONFIGURER)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-tiktok-bucket-name

# File Upload Settings
MAX_FILE_SIZE=104857600
ALLOWED_VIDEO_TYPES=video/mp4,video/avi,video/mov,video/wmv

# Server Configuration
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    
    log_warning "Fichier .env créé avec des valeurs par défaut"
    log_warning "IMPORTANT: Configurez vos credentials AWS dans tiktok-backend/.env"
else
    log_success "Fichier .env backend trouvé"
fi

# Vérifier le fichier .env du frontend
if [ ! -f "tiktok-app/.env" ]; then
    log_info "Création du fichier .env frontend..."
    echo "VITE_API_URL=http://localhost:5001/api" > tiktok-app/.env
    log_success "Fichier .env frontend créé"
else
    log_success "Fichier .env frontend trouvé"
fi

echo ""
log_info "Lancement des tests backend..."

cd tiktok-backend

# Test de connexion générale
log_info "Test 1: Connexion générale du backend"
if node test-connection.js; then
    log_success "Tests de connexion backend réussis"
else
    log_error "Tests de connexion backend échoués"
    echo ""
    log_warning "Vérifiez:"
    echo "  - MongoDB est démarré (mongod)"
    echo "  - Le fichier .env est correctement configuré"
    echo "  - Les credentials AWS sont valides"
fi

echo ""

# Test d'upload S3 (seulement si les credentials AWS sont configurés)
if grep -q "your-aws-access-key" .env; then
    log_warning "Test S3 ignoré: Credentials AWS non configurés"
    log_info "Pour tester S3, configurez vos credentials AWS dans .env"
else
    log_info "Test 2: Upload S3 complet"
    if node test-s3-upload.js; then
        log_success "Tests S3 réussis"
    else
        log_error "Tests S3 échoués"
        log_warning "Vérifiez vos credentials AWS et permissions S3"
    fi
fi

cd ..

echo ""
log_info "Instructions pour les tests frontend:"
echo ""
echo "1. Démarrez le backend:"
echo "   cd tiktok-backend && npm run dev"
echo ""
echo "2. Dans un autre terminal, démarrez le frontend:"
echo "   cd tiktok-app && npm run dev"
echo ""
echo "3. Ouvrez http://localhost:5173 dans votre navigateur"
echo ""
echo "4. Cliquez sur l'onglet 🧪 Test dans la navigation"
echo ""
echo "5. Cliquez sur 'Run Tests' pour tester la connexion frontend-backend"

echo ""
log_success "Script de test terminé!"
echo ""
log_info "Consultez le fichier GUIDE_DE_TEST.md pour plus de détails" 