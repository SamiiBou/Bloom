#!/bin/bash

# Script de configuration Google Cloud pour Veo
echo "🚀 Configuration Google Cloud pour Veo"
echo "======================================"

# Vérifier si gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI n'est pas installé"
    echo "📥 Installez-le depuis: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI trouvé"

# Vérifier l'authentification
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "🔐 Authentification Google Cloud..."
    gcloud auth login
    
    if [ $? -ne 0 ]; then
        echo "❌ Échec de l'authentification"
        exit 1
    fi
fi

echo "✅ Authentification Google Cloud active"

# Lister les projets disponibles
echo ""
echo "📋 Projets Google Cloud disponibles:"
gcloud projects list --format="table(projectId,name,projectNumber)"

echo ""
read -p "🔧 Entrez l'ID de votre projet Google Cloud: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "❌ ID de projet requis"
    exit 1
fi

# Configurer le projet par défaut
echo "⚙️  Configuration du projet par défaut..."
gcloud config set project $PROJECT_ID

if [ $? -ne 0 ]; then
    echo "❌ Échec de la configuration du projet"
    exit 1
fi

echo "✅ Projet configuré: $PROJECT_ID"

# Configurer l'authentification pour les applications
echo "🔑 Configuration de l'authentification pour les applications..."
gcloud auth application-default login

if [ $? -ne 0 ]; then
    echo "❌ Échec de la configuration de l'authentification"
    exit 1
fi

echo "✅ Authentification configurée"

# Activer l'API Vertex AI
echo "🔌 Activation de l'API Vertex AI..."
gcloud services enable aiplatform.googleapis.com

if [ $? -ne 0 ]; then
    echo "⚠️  Échec de l'activation de l'API (peut nécessiter des permissions)"
    echo "💡 Activez manuellement l'API Vertex AI dans la console Google Cloud"
else
    echo "✅ API Vertex AI activée"
fi

# Créer/mettre à jour le fichier .env
echo ""
echo "📝 Mise à jour du fichier .env..."

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "📄 Création du fichier .env..."
    touch $ENV_FILE
fi

# Fonction pour mettre à jour ou ajouter une variable d'environnement
update_env_var() {
    local key=$1
    local value=$2
    local file=$3
    
    if grep -q "^${key}=" "$file"; then
        # Mettre à jour la variable existante
        sed -i.bak "s/^${key}=.*/${key}=${value}/" "$file"
        rm "${file}.bak" 2>/dev/null
    else
        # Ajouter la nouvelle variable
        echo "${key}=${value}" >> "$file"
    fi
}

# Mettre à jour les variables Google Cloud
update_env_var "GOOGLE_CLOUD_PROJECT_ID" "$PROJECT_ID" "$ENV_FILE"
update_env_var "GOOGLE_CLOUD_LOCATION" "us-central1" "$ENV_FILE"

echo "✅ Variables d'environnement mises à jour:"
echo "   GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID"
echo "   GOOGLE_CLOUD_LOCATION=us-central1"

# Test de la configuration
echo ""
echo "🧪 Test de la configuration..."
node -e "
const veoService = require('./src/services/veoService');
veoService.validateConfiguration()
  .then(() => console.log('✅ Configuration Veo valide'))
  .catch(err => {
    console.error('❌ Erreur configuration:', err.message);
    console.log('💡 Vérifiez que l\'API Vertex AI est activée et que vous avez l\'accès à Veo');
  });
" 2>/dev/null

echo ""
echo "🎉 Configuration terminée !"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Demandez l'accès à Veo dans la console Google Cloud:"
echo "   https://console.cloud.google.com/vertex-ai/model-garden"
echo "2. Testez l'intégration avec: node test-veo-integration.js"
echo "3. Utilisez le bouton ✨ dans votre application pour générer des vidéos"
echo ""
echo "💰 Note: Veo est un service payant. Consultez la tarification Vertex AI." 