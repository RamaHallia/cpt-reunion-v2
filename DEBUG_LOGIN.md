# 🐛 Debug Page Blanche Après Login

## Logs ajoutés

Les logs suivants vont s'afficher dans la console F12 :

```
✅ Login réussi, initialisation...
📍 setView(record)
✅ Vue changée avec succès
🎨 Render principal, view: record, user: true
```

## Comment vérifier sur mobile

### Option 1 : Via ngrok + Remote Debugging

1. **Build et preview** :
```bash
npm run build
npm run preview
ngrok http 4173
```

2. **Sur mobile** :
   - Ouvre le lien ngrok
   - Login

3. **Remote debugging (Chrome)** :
   - PC : Ouvre `chrome://inspect`
   - Connecte ton téléphone en USB
   - Active le debug USB sur Android
   - Clique sur "Inspect" pour voir la console

### Option 2 : Via les logs ngrok

Dans le terminal ngrok, regarde les requêtes HTTP. Si tu vois des erreurs `500` ou `404`, note l'URL.

### Option 3 : Via eruda (console mobile)

Ajoute ça temporairement dans `index.html` :

```html
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>eruda.init();</script>
```

Puis rebuild. Tu auras une console mobile en bas à droite de l'écran.

## Erreurs possibles

### 1. Problème de state
```
❌ Erreur après login: Cannot read property 'xxx' of undefined
```
→ Un state n'est pas initialisé correctement

### 2. Problème de chargement
```
🎨 Render principal, view: record, user: true
(puis rien)
```
→ Un composant crash silencieusement

### 3. Problème réseau
```
GET /api/xxx 404 Not Found
```
→ Une requête vers Supabase échoue

## Solution temporaire

Si le problème persiste, essaie de changer la vue par défaut après login :

Dans `App.tsx` ligne 834, remplace :
```typescript
setView('record');
```

Par :
```typescript
setView('dashboard'); // ou 'history'
```

Et rebuild.

## Checklist debug

- [ ] Rebuild fait : `npm run build`
- [ ] Preview lancé : `npm run preview`
- [ ] Ngrok expose le bon port : `4173` pas `5173`
- [ ] Login réussit (pas d'erreur email/password)
- [ ] F12 ouvert sur PC (ou remote debug sur mobile)
- [ ] Console logs visibles
- [ ] Note l'erreur exacte si visible

---

**Prochaine étape** : Teste et envoie-moi les logs de la console

