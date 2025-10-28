import { useState, useEffect } from 'react';
import { Mail, Settings, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SetupReminderProps {
  userId: string;
  onNavigateToSettings: () => void;
}

export const SetupReminder = ({ userId, onNavigateToSettings }: SetupReminderProps) => {
  const [showReminder, setShowReminder] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkSetupStatus();
  }, [userId]);

  const checkSetupStatus = async () => {
    try {
      // Vérifier si l'utilisateur a déjà configuré ses paramètres
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('email_method, gmail_connected, smtp_host, smtp_user, signature_text')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking setup status:', error);
        setIsChecking(false);
        return;
      }

      // Vérifier si la config est incomplète
      const isIncomplete = !settings || 
        (settings.email_method === 'gmail' && !settings.gmail_connected) ||
        (settings.email_method === 'smtp' && (!settings.smtp_host || !settings.smtp_user)) ||
        !settings.signature_text; // Au moins une signature texte

      // Vérifier si l'utilisateur a déjà dismissé le reminder (stocké localement)
      const dismissedKey = `setup_reminder_dismissed_${userId}`;
      const wasDismissed = localStorage.getItem(dismissedKey) === 'true';

      setShowReminder(isIncomplete && !wasDismissed);
      setIsChecking(false);
    } catch (error) {
      console.error('Error in checkSetupStatus:', error);
      setIsChecking(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowReminder(false);
    // Stocker la dismissal dans localStorage
    localStorage.setItem(`setup_reminder_dismissed_${userId}`, 'true');
  };

  const handleGoToSettings = () => {
    setShowReminder(false);
    onNavigateToSettings();
  };

  if (isChecking || !showReminder || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slideDown">
      <div className="bg-gradient-to-r from-coral-500 via-sunset-500 to-peach-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Icône et Message */}
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md">
                  <Mail className="w-6 h-6 text-coral-600" />
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Bienvenue ! Configurez votre compte pour commencer
                </h3>
                <p className="text-white/90 text-sm">
                  Pour envoyer vos comptes-rendus par email, configurez votre méthode d'envoi et votre signature professionnelle dans les paramètres.
                </p>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={handleGoToSettings}
                className="bg-white text-coral-600 px-6 py-2.5 rounded-xl font-semibold hover:bg-coral-50 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 transform hover:scale-105"
              >
                <Settings className="w-5 h-5" />
                Configurer maintenant
              </button>
              
              <button
                onClick={handleDismiss}
                className="text-white hover:text-coral-100 transition-colors p-2 rounded-lg hover:bg-white/10"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Ligne décorative */}
      <div className="h-1 bg-gradient-to-r from-coral-600 via-sunset-600 to-peach-600"></div>
    </div>
  );
};

