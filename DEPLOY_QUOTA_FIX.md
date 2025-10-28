# 🚀 Déploiement du Fix de Quota - Instructions Complètes

## 📋 Résumé du Fix

### **Problème :**
- Quota diminuait lors de la suppression de réunions ❌
- Valeurs décimales bizarres affichées (31.8333...) ❌
- Incohérence entre DB et affichage ❌

### **Solution :**
1. ✅ **Backend** : Trigger SQL qui incrémente au lieu de recalculer
2. ✅ **Frontend** : Dashboard qui lit la DB au lieu de recalculer
3. ✅ **Recalibrage** : One-shot pour corriger les données existantes

---

## 🎯 Fichiers Modifiés

| Fichier | Action | Description |
|---------|--------|-------------|
| `supabase/migrations/20251027000000_fix_quota_no_recalculate.sql` | ✅ Créé | Trigger qui incrémente |
| `supabase/migrations/20251027000001_recalibrate_quotas_oneshot.sql` | ✅ Créé | Recalibrage one-shot |
| `src/components/Dashboard.tsx` | 🔧 Modifié | Utilise `minutes_used_this_month` partout |

---

## 🚀 Étapes de Déploiement

### **Étape 1 : Appliquer les Migrations SQL** ⚠️ CRITIQUE

```bash
# Naviguer vers le projet
cd "C:\Users\tech\OneDrive\Desktop\Nouveau dossier\project"

# Appliquer toutes les migrations
npx supabase db push
```

**Ce que ça fait :**
1. Crée la nouvelle fonction `update_user_quota_on_meeting_insert()` (incrémentation)
2. Recalcule TOUS les quotas existants une dernière fois
3. À partir de maintenant, le trigger incrémente uniquement

**Vérification :**
```sql
-- Dans Supabase SQL Editor, vérifier que la migration a fonctionné
SELECT user_id, minutes_used_this_month, plan_type 
FROM user_subscriptions 
ORDER BY minutes_used_this_month DESC 
LIMIT 10;
```

Vous devriez voir des **nombres entiers** (70, 459, etc.) et PAS des décimales (31.833...)

---

### **Étape 2 : Déployer le Frontend**

```bash
# Build le projet
npm run build

# Déployer (selon votre méthode de déploiement)
# Exemple avec Vercel:
# vercel --prod

# Exemple avec Netlify:
# netlify deploy --prod
```

---

### **Étape 3 : Vérification Post-Déploiement** ✅

#### **Test 1 : Affichage du Dashboard**

1. Ouvrir le Dashboard
2. Vérifier que **toutes les valeurs sont des entiers** :
   - ✅ "70 / 600 min" (pas "31.833...")
   - ✅ "459 minutes utilisées"
   - ✅ Barre de progression cohérente

#### **Test 2 : Création de Réunion**

1. Créer une réunion de 5 minutes
2. Vérifier que le quota augmente de 5
3. Recharger la page
4. Vérifier que le quota est toujours correct

#### **Test 3 : Suppression (CRITIQUE)**

1. Noter le quota actuel (ex: 70 minutes)
2. Supprimer une réunion de 10 minutes
3. **Vérifier que le quota reste à 70** ✅
4. Recharger la page
5. **Vérifier que le Dashboard affiche toujours 70** ✅

#### **Test 4 : Suppression + Création**

1. Quota actuel : 70 minutes
2. Supprimer une réunion de 10 minutes → Quota reste à 70
3. Créer une nouvelle réunion de 8 minutes
4. **Vérifier que quota = 70 + 8 = 78** ✅

---

## 🔍 Débogage en Cas de Problème

### **Problème 1 : Le quota diminue toujours**

**Cause :** Les migrations SQL n'ont pas été appliquées

**Solution :**
```bash
# Vérifier les migrations en attente
npx supabase db diff --schema public

# Appliquer
npx supabase db push
```

---

### **Problème 2 : Valeurs décimales bizarres (31.833...)**

**Cause :** Le frontend n'a pas été redéployé

**Solution :**
```bash
# Rebuild et redéployer
npm run build
# Puis redéployer
```

---

### **Problème 3 : Quota à 0 ou très bas**

**Cause :** Le recalibrage a réinitialisé les quotas

**Solution :** C'est normal si vous avez supprimé des réunions avant le fix. Les nouvelles réunions compteront correctement maintenant.

Si vous voulez restaurer le quota basé sur les meetings existantes :
```sql
-- Recalculer pour un utilisateur spécifique
DO $$
DECLARE
  total_minutes integer;
  target_user_id uuid := 'VOTRE_USER_ID'; -- Remplacer
  cycle_start timestamptz;
BEGIN
  SELECT billing_cycle_start INTO cycle_start
  FROM user_subscriptions
  WHERE user_id = target_user_id;
  
  SELECT COALESCE(SUM(ROUND(duration / 60.0)), 0)
  INTO total_minutes
  FROM meetings
  WHERE user_id = target_user_id
    AND created_at >= cycle_start;
  
  UPDATE user_subscriptions
  SET minutes_used_this_month = total_minutes
  WHERE user_id = target_user_id;
  
  RAISE NOTICE 'Quota mis à jour: % minutes', total_minutes;
END $$;
```

---

### **Problème 4 : Erreur "trigger not found"**

**Cause :** Migration incomplète

**Solution :**
```sql
-- Vérifier que le trigger existe
SELECT tgname, tgtype 
FROM pg_trigger 
WHERE tgname LIKE '%quota%';

-- Si absent, réappliquer la migration manuellement
-- Copier/coller le contenu de 20251027000000_fix_quota_no_recalculate.sql
-- dans Supabase SQL Editor
```

---

## 📊 Vérification des Logs Supabase

Après chaque création de réunion, vous devriez voir dans les logs Supabase :

```
NOTICE: Quota incrémenté pour user XXX: +5 minutes
```

Pas de `SUM()` ou de recalcul mentionné.

---

## 🎯 Checklist Post-Déploiement

- [ ] Migrations SQL appliquées (`npx supabase db push`)
- [ ] Frontend redéployé
- [ ] Dashboard affiche des entiers (pas de décimales)
- [ ] Créer une réunion → Quota augmente
- [ ] Supprimer une réunion → Quota reste stable
- [ ] Recharger la page → Quota toujours stable
- [ ] Barre de progression cohérente
- [ ] Aucune erreur console
- [ ] Logs Supabase montrent "incrémenté" (pas "recalculé")

---

## 📞 Support

Si vous rencontrez toujours des problèmes après le déploiement :

1. **Vérifier les logs Supabase** (SQL Logs)
2. **Vérifier la console browser** (F12 → Console)
3. **Vérifier que les migrations sont appliquées** :
   ```sql
   SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;
   ```
   Vous devriez voir `20251027000000` et `20251027000001`

---

## ✅ Résultat Attendu

### **Avant le Fix :**
```
Dashboard:
- Minutes: 31.8333333333332 / 600 ❌
- Suppression → Quota diminue ❌
```

### **Après le Fix :**
```
Dashboard:
- Minutes: 70 / 600 ✅
- Suppression → Quota reste stable ✅
- Création → Quota augmente correctement ✅
```

---

**Date de déploiement :** 27 octobre 2025  
**Version :** 2.0 Final  
**Status :** ✅ Prêt pour Production

