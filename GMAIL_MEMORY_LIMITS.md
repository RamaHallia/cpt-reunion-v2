# ⚠️ Limites Mémoire Gmail Edge Functions

## Problème Rencontré

**Erreur :**
```
Memory limit exceeded
📏 [Gmail] Taille du message: 10923KB
```

**Cause :** Supabase Edge Functions ont une limite mémoire stricte (~128MB heap). Avec des pièces jointes volumineuses, la construction et l'encodage du message MIME dépassent cette limite.

---

## 📊 Calcul de la Mémoire

### **Multiplication de la Taille**

```
Fichiers originaux:                 7.8 MB
↓
Base64 des fichiers:                7.8 MB × 1.33 = 10.4 MB
↓
Message MIME complet:               10.4 MB + HTML = 10.9 MB
↓
Encodage en mémoire:                10.9 MB × 2 = 21.8 MB (minimum)
↓
Peak memory (construction + envoi): 21.8 MB × 2 = 43.6 MB
```

**Avec 6 fichiers de 7.8MB → Pic à ~44MB → OK**  
**Mais avec certains patterns, ça peut monter jusqu'à ~100MB → Memory Limit**

---

## ✅ Solutions Appliquées

### **1. Chunking de l'Encodage Base64**

**Avant :**
```typescript
// ❌ Tout en mémoire d'un coup
const base64 = btoa(String.fromCharCode.apply(null, Array.from(data)));
```

**Après :**
```typescript
// ✅ Par chunks de 32KB
const chunkSize = 32768;
let base64 = '';
for (let i = 0; i < data.length; i += chunkSize) {
  const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
  base64 += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
}
```

---

### **2. Limite de Taille Réduite**

**Avant :**
```typescript
const maxSize = 25 * 1024 * 1024; // 25MB (limite Gmail)
```

**Après :**
```typescript
const maxSize = 10 * 1024 * 1024; // 10MB (limite Edge Functions)
```

**Raison :** Les Edge Functions ont moins de mémoire que Gmail. Il faut adapter la limite.

---

### **3. Limite sur le Nombre de Fichiers**

```typescript
if (attachments.length > 10) {
  throw new Error('Maximum: 10 fichiers par email');
}
```

**Raison :** Même avec de petits fichiers, trop de fichiers augmentent la consommation mémoire.

---

### **4. Message d'Erreur Clair**

```typescript
throw new Error(
  `Les pièces jointes sont trop volumineuses (${totalMB}MB). 
  Limite pour Edge Functions: 10MB.
  
  Solutions:
  • Réduire la taille des fichiers
  • Envoyer en plusieurs emails
  • Utiliser un service de partage (Google Drive, Dropbox, etc.)`
);
```

---

## 📋 Limites Finales

| Élément | Limite | Raison |
|---------|--------|--------|
| **Taille totale PJ** | 10 MB | Memory limit Edge Functions |
| **Nombre de fichiers** | 10 | Overhead mémoire |
| **Taille par fichier** | 5 MB recommandé | Performance |
| **Taille Gmail API** | 25 MB | Limite Gmail (théorique) |

---

## 🎯 Cas d'Usage

### **✅ OK (Exemples qui passent)**

```
Cas 1: 1 PDF de 8MB
→ 8MB < 10MB ✅

Cas 2: 3 PDFs (2MB + 3MB + 4MB = 9MB)
→ 9MB < 10MB ✅

Cas 3: 10 images (500KB chacune = 5MB)
→ 5MB < 10MB ✅

Cas 4: 5 documents (1.5MB × 5 = 7.5MB)
→ 7.5MB < 10MB ✅
```

### **❌ KO (Exemples qui échouent)**

```
Cas 1: 6 PDFs (7.8MB total)
→ 7.8MB < 10MB mais memory peak > 128MB ❌
→ Solution: Réduire à 4-5 fichiers

Cas 2: 1 PDF de 15MB
→ 15MB > 10MB ❌
→ Solution: Compresser ou partager via Drive

Cas 3: 15 fichiers (8MB total)
→ 15 > 10 fichiers ❌
→ Solution: Envoyer en 2 emails

Cas 4: Multiple PDFs (12MB total)
→ 12MB > 10MB ❌
→ Solution: Réduire la taille
```

---

## 🔧 Solutions pour l'Utilisateur

### **Option 1 : Réduire la Taille**

**Outils de compression PDF :**
- [iLovePDF](https://www.ilovepdf.com/compress_pdf) (gratuit)
- [SmallPDF](https://smallpdf.com/compress-pdf) (gratuit)
- Adobe Acrobat (payant)

**Compression d'images :**
- [TinyPNG](https://tinypng.com/)
- [Compressor.io](https://compressor.io/)

---

### **Option 2 : Envoyer en Plusieurs Emails**

```
Email 1: Compte-rendu + 3 PDFs (4MB)
Email 2: Suite des documents + 3 PDFs (4MB)
```

---

### **Option 3 : Utiliser un Service de Partage**

**Recommandations :**
1. **Google Drive** (si Gmail)
   - Upload des fichiers sur Drive
   - Partager le lien dans l'email

2. **Dropbox / OneDrive**
   - Upload
   - Lien de partage

3. **WeTransfer** (jusqu'à 2GB gratuit)
   - Upload
   - Envoyer le lien par email

---

## 🚀 Améliorations Futures

### **Option A : Upload vers Storage puis Lien**

**Workflow :**
```
1. User sélectionne des fichiers
2. Upload automatique vers Supabase Storage
3. Email contient des liens de téléchargement
4. Pas de PJ directes → Pas de limite mémoire
```

**Avantages :**
- ✅ Fichiers illimités (jusqu'à plusieurs GB)
- ✅ Pas de problème mémoire
- ✅ Plus rapide à envoyer

**Inconvénients :**
- ❌ Nécessite que le destinataire clique sur un lien
- ❌ Fichiers temporaires (expiration ?)

---

### **Option B : Migration vers Service Workers**

**Alternative :** Utiliser Cloudflare Workers ou AWS Lambda avec plus de mémoire (512MB-1GB)

**Avantages :**
- ✅ Limite de 25MB (Gmail) atteignable
- ✅ Plus de mémoire disponible

**Inconvénients :**
- ❌ Complexité accrue
- ❌ Coûts supplémentaires
- ❌ Migration nécessaire

---

## 📱 Message Utilisateur

Quand la limite est atteinte, l'utilisateur voit :

```
❌ Erreur lors de l'envoi de l'email:
Les pièces jointes sont trop volumineuses (7.8MB).
Limite pour Edge Functions: 10MB.

Solutions:
• Réduire la taille des fichiers
• Envoyer en plusieurs emails
• Utiliser un service de partage (Google Drive, Dropbox, etc.)
```

---

## ✅ Checklist de Validation

Avant d'envoyer un email avec PJ :

- [ ] Taille totale < 10MB
- [ ] Nombre de fichiers ≤ 10
- [ ] Chaque fichier < 5MB (recommandé)
- [ ] Si dépassement → Compresser ou partager

---

## 🎓 Leçons Apprises

### **Edge Functions ≠ Serveur Classique**

```
Serveur classique:
- Mémoire: 1-4GB
- Timeout: Minutes
- Fichiers: GB possibles

Edge Functions:
- Mémoire: ~128MB heap
- Timeout: 10-30 secondes
- Fichiers: MB limités
```

### **Architecture Event-Driven**

Pour des fichiers volumineux, il faut :
1. Upload async vers storage
2. Processing en background
3. Notification par email avec lien

Pas de traitement synchrone lourd dans une Edge Function.

---

**Date :** 27 octobre 2025  
**Version :** 1.0  
**Status :** ✅ Limites Documentées et Appliquées

