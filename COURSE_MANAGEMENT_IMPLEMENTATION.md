# Gestion des cours - Implémentation complète

## Résumé
Ajout de la fonctionnalité complète de gestion des cours (CRUD) pour les administrateurs et mainteneurs, avec des boutons d'édition et de suppression directement dans les listes de cours.

## Changements effectués

### 1. Nouveau composant : EditLectureDialog
**Fichier** : `src/components/specialties/EditLectureDialog.tsx`

- Composant de dialogue pour modifier un cours existant
- Formulaire avec titre et description (similaire à AddLectureDialog)
- Validation du titre requis
- Messages toast en français
- API : `PUT /api/lectures/{id}`

### 2. Modifications de la page Specialty
**Fichier** : `src/app/matieres/[specialtyId]/page.tsx`

#### Variables d'état ajoutées :
```typescript
const [isEditLectureOpen, setIsEditLectureOpen] = useState(false)
const [selectedLecture, setSelectedLecture] = useState<any>(null)
const isAdminOrMaintainer = user?.role === 'admin' || user?.role === 'maintainer'
```

#### Fonctions handler ajoutées :
- **`handleEditLecture(lecture)`** : Ouvre le dialogue d'édition avec le cours sélectionné
- **`handleDeleteLecture(lectureId, title)`** : Supprime un cours après confirmation (avec confirm natif)

#### Interface utilisateur ajoutée :

1. **Section "Gestion des cours"** : 
   - Card avec bouton "Ajouter un cours"
   - Visible uniquement pour admin/maintainer
   - Utilise le composant existant `AddLectureDialog`

2. **Boutons Edit/Delete sur chaque cours** :
   - Ajoutés dans la vue mobile (boutons avec icônes)
   - Ajoutés dans la vue desktop (table)
   - Ajoutés pour les cours non groupés ET les cours groupés
   - Icônes :
     - Edit (bleu) : Modifier le cours
     - Trash (rouge) : Supprimer le cours
   - Visibles uniquement si `isAdminOrMaintainer`

3. **Dialogues câblés** :
   - `AddLectureDialog` : Utilisé avec le nouveau bouton
   - `EditLectureDialog` : Nouveau composant pour l'édition

### 3. Accès maintainer confirmé
**Fichier** : `src/components/questions/QuestionManagementDialog.tsx`

- Vérifié que la variable `isAdmin` est déjà définie comme :
  ```typescript
  const isAdmin = user?.role === 'admin' || user?.role === 'maintainer';
  ```
- Les mainteneurs ont déjà accès à tous les dialogues d'admin de questions
- Aucune modification nécessaire

## Fonctionnalités

### Pour Admin et Maintainer :
✅ Ajouter un cours via le bouton "Ajouter un cours"
✅ Modifier un cours via le bouton Edit (icône bleue)
✅ Supprimer un cours via le bouton Delete (icône rouge) avec confirmation
✅ Tous les boutons disponibles dans les vues mobile et desktop
✅ Tous les boutons disponibles pour les cours groupés et non groupés
✅ Accès complet aux dialogues d'admin de questions

## Tests recommandés

1. **Ajout de cours** :
   - Cliquer sur "Ajouter un cours"
   - Remplir le formulaire
   - Vérifier que le cours apparaît dans la liste

2. **Édition de cours** :
   - Cliquer sur l'icône Edit (bleue) d'un cours
   - Modifier le titre et/ou la description
   - Vérifier que les changements sont sauvegardés

3. **Suppression de cours** :
   - Cliquer sur l'icône Trash (rouge) d'un cours
   - Confirmer la suppression
   - Vérifier que le cours disparaît de la liste

4. **Vues responsives** :
   - Tester sur mobile : les boutons doivent être visibles dans les cartes
   - Tester sur desktop : les boutons doivent être dans la colonne "Action"

5. **Accès maintainer** :
   - Se connecter en tant que maintainer
   - Vérifier l'accès à tous les dialogues de gestion des cours
   - Vérifier l'accès aux dialogues de gestion des questions

## API utilisées

- `POST /api/lectures` : Créer un cours (AddLectureDialog)
- `PUT /api/lectures/{id}` : Mettre à jour un cours (EditLectureDialog)
- `DELETE /api/lectures/{id}` : Supprimer un cours (handleDeleteLecture)

## Traductions françaises

Tous les textes sont en français :
- "Gestion des cours"
- "Ajouter un cours"
- "Modifier le cours"
- "Supprimer le cours"
- "Le cours a été mis à jour avec succès"
- "Le cours \"{title}\" a été supprimé avec succès"
- Messages d'erreur appropriés

## Notes techniques

- La gestion des cours respecte la hiérarchie des rôles existante
- Les dialogues se ferment automatiquement après une action réussie
- La liste des cours se rafraîchit automatiquement via `fetchSpecialtyAndLectures()`
- Les composants utilisent les mêmes patterns que les autres dialogues d'édition
- Cohérence visuelle avec le reste de l'interface (couleurs, icônes, espacements)
