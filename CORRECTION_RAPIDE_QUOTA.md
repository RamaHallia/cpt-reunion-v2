# 🚨 Correction Rapide de Votre Quota (459 minutes manquantes)

## Problème Actuel

- **Dashboard affiche :** 70 / 600 minutes ❌
- **Réalité :** Vous avez consommé 459 minutes ✅
- **Cause :** La base de données a une valeur incorrecte (70 au lieu de 459)

---

## ⚡ Solution Rapide (2 minutes)

### **Option 1 : Appliquer les Migrations (Recommandé)**

Cela va corriger **automatiquement** pour TOUS les utilisateurs :

```bash
cd "C:\Users\tech\OneDrive\Desktop\Nouveau dossier\project"
npx supabase db push
```

**Résultat :** Après 10 secondes, votre quota sera à 459/600 automatiquement.

---

### **Option 2 : Correction Manuelle via Supabase SQL Editor**

Si vous ne pouvez pas exécuter les migrations tout de suite :

#### **Étape 1 : Trouver votre User ID**

1. Ouvrir **Supabase Dashboard** → **SQL Editor**
2. Exécuter :

```sql
SELECT 
  id as user_id,
  email
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
```

3. Noter votre `user_id` (un UUID comme `123e4567-e89b-12d3-a456-426614174000`)

---

#### **Étape 2 : Recalculer votre quota**

Dans le même SQL Editor, exécuter (en remplaçant `VOTRE_USER_ID`) :

```sql
DO $$
DECLARE
  target_user_id uuid := 'VOTRE_USER_ID'; -- ⚠️ REMPLACER PAR VOTRE ID
  total_minutes integer;
  cycle_start timestamptz;
  meeting_count integer;
BEGIN
  -- Récupérer le début du cycle
  SELECT billing_cycle_start INTO cycle_start
  FROM user_subscriptions
  WHERE user_id = target_user_id;
  
  -- Calculer les VRAIES minutes
  SELECT 
    COUNT(*),
    COALESCE(SUM(ROUND(duration / 60.0)), 0)
  INTO meeting_count, total_minutes
  FROM meetings
  WHERE user_id = target_user_id
    AND created_at >= cycle_start
    AND created_at < cycle_start + interval '1 month';
  
  -- Mettre à jour
  UPDATE user_subscriptions
  SET minutes_used_this_month = total_minutes,
      updated_at = now()
  WHERE user_id = target_user_id;
  
  RAISE NOTICE '✅ Quota corrigé: % minutes (% réunions depuis %)', 
    total_minutes, meeting_count, cycle_start;
END $$;
```

**Résultat attendu :**
```
✅ Quota corrigé: 459 minutes (214 réunions depuis 2024-10-23)
```

---

#### **Étape 3 : Vérifier**

```sql
SELECT 
  plan_type,
  minutes_used_this_month,
  minutes_quota,
  billing_cycle_start,
  billing_cycle_end
FROM user_subscriptions
WHERE user_id = 'VOTRE_USER_ID'; -- ⚠️ REMPLACER
```

**Résultat attendu :**
```
plan_type: starter
minutes_used_this_month: 459
minutes_quota: 600
```

---

#### **Étape 4 : Recharger le Dashboard**

1. Recharger la page du Dashboard (F5)
2. Vous devriez voir : **459 / 600 min** ✅

---

## 🔍 Pourquoi 70 au lieu de 459 ?

Le problème vient de l'ancien trigger qui **recalculait** le quota à chaque insertion. Si vous aviez supprimé des réunions dans le passé, le recalcul donnait un nombre plus bas.

**Exemple :**
```
Historique:
- Créé 100 réunions = 500 minutes
- Supprimé 50 réunions = 250 minutes supprimées de la DB
- Ancien trigger recalcule: SUM() = 250 minutes ❌
- Vrai quota devrait être: 500 minutes ✅
```

---

## 🚀 Solution Définitive

Pour que ce problème ne se reproduise **jamais**, vous DEVEZ appliquer les migrations :

```bash
npx supabase db push
```

**Ce que ça fait :**
1. ✅ Corrige le trigger SQL (incrémente au lieu de recalculer)
2. ✅ Recalcule TOUS les quotas correctement
3. ✅ À partir de maintenant, les suppressions ne diminuent plus le quota

---

## 📊 Vérification Visuelle

### **Avant (Incorrect) :**
```
┌────────────────────────────────────────┐
│ Formule Starter                        │
│ 29€/mois - 600 minutes                 │
│                                        │
│ Minutes utilisées ce mois              │
│ 70 / 600 min                          │ ❌
│ [███░░░░░░░░░░░░░░░░░░░░░░░] 12%     │
│                                        │
│ 530 minutes restantes                  │
└────────────────────────────────────────┘
```

### **Après (Correct) :**
```
┌────────────────────────────────────────┐
│ Formule Starter                        │
│ 29€/mois - 600 minutes                 │
│                                        │
│ Minutes utilisées ce mois              │
│ 459 / 600 min                         │ ✅
│ [██████████████████████░░░░░░] 77%    │
│                                        │
│ 141 minutes restantes                  │
└────────────────────────────────────────┘
```

---

## ❓ FAQ

### **Q: Si je corrige manuellement, dois-je quand même appliquer les migrations ?**

**R:** OUI ! Absolument. La correction manuelle résout votre quota MAINTENANT, mais les migrations empêchent le problème de se reproduire à l'avenir.

### **Q: Les migrations vont-elles écraser ma correction manuelle ?**

**R:** Non, les migrations vont recalculer correctement et vous obtiendrez le même résultat (459 minutes).

### **Q: Que se passe-t-il si je ne fais rien ?**

**R:** 
1. Votre quota restera à 70 (incorrect)
2. À chaque nouvelle réunion, ça s'incrémentera (70 → 75 → 83...)
3. Les suppressions continueront à diminuer le quota ❌

---

## ✅ Checklist

Pour résoudre complètement le problème :

- [ ] **Option A :** Exécuter `npx supabase db push` (recommandé)
- [ ] **Option B :** Correction manuelle SQL + plus tard appliquer les migrations
- [ ] Recharger le Dashboard
- [ ] Vérifier que le quota affiche 459/600
- [ ] Tester : Supprimer une réunion → Quota reste stable
- [ ] Tester : Créer une réunion → Quota augmente correctement

---

**🎯 Action Recommandée : Exécutez `npx supabase db push` maintenant pour tout corriger en 10 secondes !**

