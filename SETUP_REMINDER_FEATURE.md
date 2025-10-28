# 🎯 Fonctionnalité : Banner de Configuration Initiale

## Vue d'ensemble

Un **banner professionnel** s'affiche automatiquement pour les nouveaux utilisateurs qui n'ont pas encore configuré leurs paramètres d'envoi d'emails et de signature.

---

## 🎨 Design

### **Apparence**

Le banner respecte complètement la charte graphique Hallia :

- **Couleurs** : Dégradé coral → sunset → peach (identique au branding)
- **Position** : Fixed en haut de la page
- **Animation** : Slide down élégant avec easing cubic-bezier
- **Responsive** : S'adapte parfaitement mobile/desktop
- **Shadow** : Ombre légère pour profondeur

### **Structure Visuelle**

```
┌────────────────────────────────────────────────────────────────┐
│  [🔵]  ⚠️ Bienvenue ! Configurez votre compte pour commencer  │
│        Pour envoyer vos comptes-rendus par email, configurez   │
│        votre méthode d'envoi...                                │
│                                    [Configurer maintenant] [X] │
└────────────────────────────────────────────────────────────────┘
│████████████████████ (Ligne décorative dégradée) ██████████████│
```

---

## 🔍 Détection Automatique

Le banner s'affiche si l'utilisateur n'a **PAS** configuré :

### **Critères de détection :**

✅ **Gmail non connecté** : `email_method = 'gmail'` ET `gmail_connected = false`  
✅ **SMTP incomplet** : `email_method = 'smtp'` ET (`smtp_host` est NULL OU `smtp_user` est NULL)  
✅ **Signature manquante** : `signature_text` est NULL ou vide

### **Logique SQL :**

```typescript
const isIncomplete = !settings || 
  (settings.email_method === 'gmail' && !settings.gmail_connected) ||
  (settings.email_method === 'smtp' && (!settings.smtp_host || !settings.smtp_user)) ||
  !settings.signature_text;
```

**Note :** Les champs `sender_email` et `sender_name` ont été retirés car ils sont automatiquement gérés par Gmail/SMTP.

---

## 🎬 Comportement

### **1. Affichage Initial**

- ✅ S'affiche automatiquement au chargement si config incomplète
- ✅ Animation slide-down fluide (0.5s)
- ✅ Position fixed en haut (z-index: 50)

### **2. Interactions**

#### **Bouton "Configurer maintenant"** (Primaire)
- ✅ Ferme le banner
- ✅ Navigue vers la page Paramètres
- ✅ Animation scale au hover

#### **Bouton "X"** (Secondaire)
- ✅ Ferme le banner
- ✅ Stocke la dismissal dans **localStorage**
- ✅ Ne réapparaît pas jusqu'au prochain rechargement

### **3. Persistance**

**localStorage utilisé :**
```javascript
Key: `setup_reminder_dismissed_${userId}`
Value: 'true'
```

**Durée :** Jusqu'au prochain rechargement de la page  
**Raison :** Si l'utilisateur dismiss mais ne configure pas, on veut lui rappeler plus tard

---

## 📁 Fichiers Créés/Modifiés

### **1. `src/components/SetupReminder.tsx`** ✅

**Nouveau composant** avec :
- ✅ Détection automatique de la config
- ✅ Gestion du state (show/dismiss)
- ✅ localStorage pour persistance
- ✅ Navigation vers Settings
- ✅ Design responsive

### **2. `src/App.tsx`** ✅

**Modifications :**
- ✅ Import du composant `SetupReminder`
- ✅ Ajout juste avant le sidebar :
  ```tsx
  {user && (
    <SetupReminder 
      userId={user.id} 
      onNavigateToSettings={() => setView('settings')} 
    />
  )}
  ```

### **3. `src/index.css`** ✅

**Animations ajoutées :**
- ✅ `@keyframes slideDown` : Slide depuis le haut
- ✅ `@keyframes fadeIn` : Apparition en fondu
- ✅ `@keyframes scaleIn` : Scale + fade pour modal
- ✅ Classes : `.animate-slideDown`, `.animate-fadeIn`, `.animate-scaleIn`

---

## 🎯 Cas d'Utilisation

### **Scénario 1 : Nouvel Utilisateur**

```
1. User crée son compte
2. Se connecte pour la première fois
3. 🎉 Banner apparaît en haut
4. User clique "Configurer maintenant"
5. Redirigé vers Paramètres
6. Configure Gmail/SMTP + signature
7. Sauvegarde
8. ✅ Banner ne s'affiche plus
```

### **Scénario 2 : Utilisateur qui Dismiss**

```
1. User voit le banner
2. Clique sur "X" (dismiss)
3. Banner disparaît
4. Continue à utiliser l'app
5. Recharge la page
6. 🔄 Banner réapparaît (pas configuré)
```

### **Scénario 3 : Utilisateur Configuré**

```
1. User a déjà tout configuré
2. Se connecte
3. ✅ Banner ne s'affiche jamais
```

---

## 🔧 Configuration

### **Props du Composant**

```typescript
interface SetupReminderProps {
  userId: string;              // ID de l'utilisateur (pour requêtes DB)
  onNavigateToSettings: () => void;  // Callback pour naviguer vers Settings
}
```

### **États Internes**

```typescript
const [showReminder, setShowReminder] = useState(false);
const [isDismissed, setIsDismissed] = useState(false);
const [isChecking, setIsChecking] = useState(true);
```

---

## 🎨 Personnalisation

### **Couleurs** (facilement modifiables)

```tsx
// Banner background
className="bg-gradient-to-r from-coral-500 via-sunset-500 to-peach-500"

// Bouton primaire
className="bg-white text-coral-600 hover:bg-coral-50"

// Ligne décorative
className="bg-gradient-to-r from-coral-600 via-sunset-600 to-peach-600"
```

### **Texte**

Modifiez dans `SetupReminder.tsx` :
- Ligne 78 : Titre principal
- Ligne 82 : Description

---

## 🚀 Déploiement

### **Étapes :**

1. ✅ Fichiers déjà créés/modifiés
2. ✅ Pas de migration DB nécessaire
3. ✅ Build le projet : `npm run build`
4. ✅ Déployer

### **Test :**

1. Créer un nouveau compte utilisateur
2. Vérifier que le banner apparaît
3. Tester le bouton "Configurer maintenant"
4. Configurer les paramètres
5. Vérifier que le banner disparaît

---

## 📊 Métriques Possibles

Pour suivre l'efficacité de la fonctionnalité :

- **Taux d'affichage** : % users qui voient le banner
- **Taux de clic** : % qui cliquent "Configurer maintenant"
- **Taux de dismiss** : % qui cliquent "X"
- **Taux de complétion** : % qui configurent après avoir vu le banner

---

## 🔄 Améliorations Futures

### **v1.1 - Persistance Serveur**
- Stocker la dismissal en DB au lieu de localStorage
- Permet de ne plus afficher le banner même après changement de device

### **v1.2 - Progress Bar**
- Afficher une barre de progression : "2/4 étapes complétées"
- Détailler ce qui reste à configurer

### **v1.3 - Tutorial Interactif**
- Ajouter un mini-tutorial guidé après le clic
- Highlight des champs à remplir

### **v1.4 - Smart Timing**
- Ne pas afficher le banner pendant le premier enregistrement
- Afficher après la première réunion terminée

---

## ✅ Checklist de Vérification

- [x] Banner s'affiche pour nouveaux users
- [x] Banner ne s'affiche PAS pour users configurés
- [x] Bouton "Configurer" navigue vers Settings
- [x] Bouton "X" ferme le banner
- [x] Animation slide-down fluide
- [x] Responsive (mobile + desktop)
- [x] Respecte la charte graphique
- [x] localStorage fonctionne
- [x] Pas d'erreurs console
- [x] Pas d'erreurs linter

---

**Date de création :** 26 octobre 2025  
**Version :** 1.0  
**Status :** ✅ Production Ready


