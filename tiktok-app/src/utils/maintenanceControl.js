// Utilitaire pour contrôler le mode maintenance
// Peut être utilisé depuis la console du navigateur ou via d'autres scripts

class MaintenanceControl {
  static STORAGE_KEY = 'maintenanceMode';

  // Activer le mode maintenance
  static enable() {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    console.log('🚧 Mode maintenance ACTIVÉ');
    console.log('Pour désactiver : MaintenanceControl.disable()');
    this.reload();
  }

  // Désactiver le mode maintenance
  static disable() {
    localStorage.setItem(this.STORAGE_KEY, 'false');
    console.log('✅ Mode maintenance DÉSACTIVÉ');
    this.reload();
  }

  // Vérifier le statut actuel
  static status() {
    const status = localStorage.getItem(this.STORAGE_KEY);
    const isActive = status === null ? true : status === 'true';
    console.log(`Mode maintenance : ${isActive ? '🚧 ACTIVÉ' : '✅ DÉSACTIVÉ'}`);
    return isActive;
  }

  // Basculer le mode
  static toggle() {
    const currentStatus = this.status();
    if (currentStatus) {
      this.disable();
    } else {
      this.enable();
    }
  }

  // Réinitialiser (retour à l'état par défaut : maintenance activée)
  static reset() {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🔄 Mode maintenance RÉINITIALISÉ (par défaut : activé)');
    this.reload();
  }

  // Recharger la page
  static reload() {
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  // Planifier l'activation/désactivation
  static schedule(action, delayMinutes) {
    const delay = delayMinutes * 60 * 1000; // Convertir minutes en millisecondes
    const targetTime = new Date(Date.now() + delay);
    
    console.log(`⏱️ Planification : ${action} du mode maintenance à ${targetTime.toLocaleTimeString()}`);
    
    setTimeout(() => {
      if (action === 'enable') {
        this.enable();
      } else if (action === 'disable') {
        this.disable();
      }
    }, delay);
  }

  // Afficher l'aide
  static help() {
    console.log(`
🚧 CONTRÔLE MODE MAINTENANCE
═══════════════════════════

MaintenanceControl.enable()          - Activer la maintenance
MaintenanceControl.disable()         - Désactiver la maintenance
MaintenanceControl.toggle()          - Basculer le mode
MaintenanceControl.status()          - Vérifier le statut
MaintenanceControl.reset()           - Réinitialiser
MaintenanceControl.schedule('enable', 5)  - Activer dans 5 minutes
MaintenanceControl.schedule('disable', 10) - Désactiver dans 10 minutes
MaintenanceControl.help()            - Afficher cette aide

RACCOURCIS CLAVIER :
- Ctrl+Alt+M : Basculer le mode maintenance
- Ctrl+Shift+M : Sortir du mode maintenance (depuis la page)
    `);
  }
}

// Rendre disponible globalement pour utilisation dans la console
window.MaintenanceControl = MaintenanceControl;

// Afficher le statut au chargement
if (typeof window !== 'undefined') {
  console.log('🔧 MaintenanceControl chargé. Tapez MaintenanceControl.help() pour voir les commandes.');
  MaintenanceControl.status();
}

export default MaintenanceControl; 