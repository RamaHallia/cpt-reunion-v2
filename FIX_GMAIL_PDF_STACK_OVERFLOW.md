# 🐛 Fix : Stack Overflow lors de l'envoi de PDF par Gmail

## Problème

**Erreur rencontrée :**
```
POST .../send-email-gmail 500 (Internal Server Error)
Error: Maximum call stack size exceeded
```

**Cause :** Lors de l'envoi de fichiers PDF (même légers), la conversion en base64 causait un **stack overflow** à cause de cette ligne :

```typescript
// ❌ BUGUÉ
const base64 = btoa(String.fromCharCode(...data));
// Passe tous les bytes comme arguments individuels → stack overflow
```

---

## ✅ Solution Appliquée

### **Modification 1 : Conversion chunked pour images inline**

**Fichier :** `supabase/functions/send-email-gmail/index.ts` (ligne ~179)

**Avant :**
```typescript
// Convertir Uint8Array en base64
const base64 = btoa(String.fromCharCode(...img.data));
```

**Après :**
```typescript
// Convertir Uint8Array en base64 (chunk par chunk pour éviter stack overflow)
const chunkSize = 8192;
let base64 = '';
for (let i = 0; i < img.data.length; i += chunkSize) {
  const chunk = img.data.slice(i, i + chunkSize);
  base64 += btoa(String.fromCharCode(...chunk));
}
```

---

### **Modification 2 : Encodage chunked pour le message complet**

**Fichier :** `supabase/functions/send-email-gmail/index.ts` (ligne ~218)

**Avant :**
```typescript
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

**Après :**
```typescript
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  
  // Convertir en base64 chunk par chunk pour éviter stack overflow
  const chunkSize = 8192;
  let base64 = '';
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    base64 += btoa(String.fromCharCode(...chunk));
  }
  
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

---

### **Modification 3 : Vérification de la taille des PJ**

**Fichier :** `supabase/functions/send-email-gmail/index.ts` (ligne ~306)

**Ajout :**
```typescript
// Vérifier la taille totale des pièces jointes (limite Gmail: 25MB)
if (attachments && attachments.length > 0) {
  const totalSize = attachments.reduce((sum, att) => {
    // Estimer la taille du base64 (plus grand que l'original)
    const estimatedSize = (att.content.length * 3) / 4;
    return sum + estimatedSize;
  }, 0);
  
  const maxSize = 25 * 1024 * 1024; // 25MB
  if (totalSize > maxSize) {
    throw new Error(`Les pièces jointes sont trop volumineuses (${Math.round(totalSize / 1024 / 1024)}MB). La limite Gmail est de 25MB.`);
  }
  
  console.log(`📎 Taille totale des PJ: ${Math.round(totalSize / 1024 / 1024)}MB`);
}
```

---

## 🚀 Déploiement

### **Commande à exécuter :**

```bash
cd supabase
npx supabase functions deploy send-email-gmail
```

**Si erreur de login :**
```bash
npx supabase login
# Puis réessayer le deploy
```

---

## 🎯 Résultat Attendu

### **Avant (Bugué) :**
```
User joint un PDF de 500KB
↓
Conversion en base64 : String.fromCharCode(...500000 bytes)
↓
❌ Stack overflow: Maximum call stack size exceeded
↓
Email non envoyé
```

### **Après (Corrigé) :**
```
User joint un PDF de 500KB
↓
Conversion chunked : 500KB / 8KB = 62 chunks
↓
Chaque chunk converti séparément
↓
✅ Pas de stack overflow
↓
Email envoyé avec succès !
```

---

## 📊 Limites

### **Tailles de fichiers supportées :**

| Type | Limite |
|------|--------|
| **Par fichier** | Aucune limite technique (chunked) |
| **Total PJ** | 25 MB (limite Gmail) |
| **Recommandé** | < 10 MB pour de meilleures perfs |

### **Si dépassement de 25MB :**

L'utilisateur verra :
```
❌ Erreur lors de l'envoi de l'email:
Les pièces jointes sont trop volumineuses (30MB). 
La limite Gmail est de 25MB.
```

---

## 🔍 Explication Technique

### **Pourquoi `String.fromCharCode(...array)` cause un stack overflow ?**

```javascript
// Mauvais : Passe chaque byte comme argument séparé
String.fromCharCode(...[1, 2, 3, ..., 500000])
// Équivalent à:
String.fromCharCode(1, 2, 3, ..., 500000)
// → 500000 arguments sur la pile → Stack overflow !
```

### **Solution : Chunking**

```javascript
// Bon : Traite par petits morceaux
const chunkSize = 8192; // 8KB
for (let i = 0; i < data.length; i += chunkSize) {
  const chunk = data.slice(i, i + chunkSize);
  // Max 8192 arguments → Pas de problème
  base64 += btoa(String.fromCharCode(...chunk));
}
```

---

## 🧪 Tests à Effectuer

### **Test 1 : PDF Léger (< 1MB)**
1. ✅ Créer un email avec un PDF de 500KB
2. ✅ Envoyer via Gmail
3. ✅ Vérifier que l'email est envoyé
4. ✅ Vérifier que le PDF est reçu correctement

### **Test 2 : Plusieurs PDFs**
1. ✅ Créer un email avec 3 PDFs (2MB + 3MB + 4MB = 9MB)
2. ✅ Envoyer via Gmail
3. ✅ Vérifier que l'email est envoyé
4. ✅ Vérifier que les 3 PDFs sont reçus

### **Test 3 : Dépassement de limite**
1. ✅ Créer un email avec un PDF de 30MB
2. ✅ Envoyer via Gmail
3. ✅ Vérifier que l'erreur est claire et explicite

---

## 📁 Fichiers Modifiés

| Fichier | Modifications |
|---------|---------------|
| `supabase/functions/send-email-gmail/index.ts` | ✅ Chunking ligne ~179 |
| `supabase/functions/send-email-gmail/index.ts` | ✅ Chunking ligne ~218 |
| `supabase/functions/send-email-gmail/index.ts` | ✅ Vérification taille ligne ~306 |
| `FIX_GMAIL_PDF_STACK_OVERFLOW.md` | 📝 Ce document |

---

## ✅ Checklist de Déploiement

- [x] Code modifié (chunking + limite)
- [ ] Fonction Gmail redéployée (`npx supabase functions deploy send-email-gmail`)
- [ ] Test avec PDF léger (< 1MB)
- [ ] Test avec plusieurs PDFs
- [ ] Test de dépassement de limite
- [ ] Validation que les PDFs sont bien reçus

---

## 🎓 Leçons Apprises

### **Erreur à éviter :**

```typescript
// ❌ NE JAMAIS FAIRE avec de gros arrays
btoa(String.fromCharCode(...largeArray))

// ❌ Pareil pour toute fonction variadique
Math.max(...millionNumbers)
```

### **Bonne pratique :**

```typescript
// ✅ TOUJOURS chunker pour les gros volumes
const chunkSize = 8192;
for (let i = 0; i < largeArray.length; i += chunkSize) {
  const chunk = largeArray.slice(i, i + chunkSize);
  processChunk(chunk);
}
```

---

**Date :** 27 octobre 2025  
**Version :** 1.0  
**Status :** ✅ Code Corrigé, En Attente de Déploiement

