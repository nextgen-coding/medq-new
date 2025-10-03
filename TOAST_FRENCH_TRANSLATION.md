# Traduction des toasts en français - Résumé

## Objectif
Remplacer tous les messages toast en anglais et les clés i18n par du texte français codé en dur dans les dialogues d'administration.

## Fichiers modifiés

### 1. useQuestionEdit.ts
**Chemin** : `src/components/questions/edit/useQuestionEdit.ts`

#### Changements :
- ❌ `t('common.error')` → ✅ `'Erreur'`
- ❌ `t('common.tryAgain')` → ✅ `'Veuillez réessayer.'`
- ❌ `t('auth.notAuthenticated')` → ✅ `'Non authentifié'`
- ❌ `t('auth.pleaseSignIn')` → ✅ `'Veuillez vous connecter.'`
- ❌ `'No question ID available'` → ✅ `'Identifiant de question manquant.'`
- ❌ `t('common.success')` → ✅ `'Succès'`
- ❌ `t('questions.updatedSuccessfully')` → ✅ `'Question mise à jour avec succès.'`

**Fonctions affectées :**
- `fetchQuestion()` - Erreur de chargement
- `saveQuestion()` - Erreurs d'authentification, validation, et succès de mise à jour

### 2. OpenQuestion.tsx
**Chemin** : `src/components/questions/OpenQuestion.tsx`

#### Changements :
- ❌ `"Error"` → ✅ `"Erreur"`
- ❌ `"Failed to update question visibility"` → ✅ `"Échec de la mise à jour de la visibilité"`
- ❌ `'Question hidden'` → ✅ `'Question masquée'`
- ❌ `'Question unhidden'` → ✅ `'Question visible'`
- ❌ `'The question is now hidden from students.'` → ✅ `'La question est maintenant masquée des étudiants.'`
- ❌ `'The question is now visible to students.'` → ✅ `'La question est maintenant visible aux étudiants.'`

**Fonction affectée :**
- `handleToggleVisibility()` - Affichage/masquage de question

### 3. ManagementTab.tsx
**Chemin** : `src/components/admin/ManagementTab.tsx`

#### Changements :
- ❌ `'Error'` → ✅ `'Erreur'`
- ❌ `'Failed to load specialties'` → ✅ `'Échec du chargement des matières'`
- ❌ `'Failed to load lectures'` → ✅ `'Échec du chargement des cours'`
- ❌ `'Delete Specialty'` → ✅ `'Supprimer la matière'`
- ❌ `'Are you sure you want to delete...'` → ✅ `'Êtes-vous sûr de vouloir supprimer...'`
- ❌ `'Success'` → ✅ `'Succès'`
- ❌ `'Specialty deleted successfully'` → ✅ `'Matière supprimée avec succès'`
- ❌ `'Failed to delete specialty'` → ✅ `'Échec de la suppression de la matière'`
- ❌ `'Delete Course'` → ✅ `'Supprimer le cours'`
- ❌ `'Course deleted successfully'` → ✅ `'Cours supprimé avec succès'`
- ❌ `'Failed to delete course'` → ✅ `'Échec de la suppression du cours'`

**Fonctions affectées :**
- `fetchSpecialties()` - Chargement des matières
- `fetchLectures()` - Chargement des cours
- `handleDeleteSpecialty()` - Suppression de matière
- `handleDeleteLecture()` - Suppression de cours

## Composants déjà en français

Les composants suivants avaient déjà tous leurs toasts en français :

✅ **GroupedMcqEditDialog.tsx** - Édition de QCM groupés
✅ **GroupedQrocEditDialog.tsx** - Édition de QROC groupés  
✅ **ClinicalCaseEditDialog.tsx** - Édition de cas cliniques
✅ **QuestionEditContent.tsx** - Contenu d'édition de question
✅ **CreateQuestionDialog.tsx** - Création de questions
✅ **MCQQuestion.tsx** - Affichage de QCM
✅ **ClinicalCaseQuestion.tsx** - Affichage de cas cliniques
✅ **AddLectureDialog.tsx** - Ajout de cours
✅ **EditLectureDialog.tsx** - Édition de cours

## Catégories de messages traduits

### Messages de succès
- Mise à jour de question
- Suppression de matière/cours
- Visibilité de question modifiée

### Messages d'erreur
- Échec de chargement
- Échec de mise à jour
- Échec de suppression
- Erreurs d'authentification
- Erreurs de validation

### Messages de confirmation
- Suppression de matière
- Suppression de cours
- Modification de visibilité

## Impact

- ✅ Tous les toasts des dialogues d'administration sont maintenant en français
- ✅ Plus de clés i18n affichées à l'utilisateur
- ✅ Cohérence linguistique dans toute l'interface admin
- ✅ Meilleure expérience utilisateur pour les administrateurs/mainteneurs

## Tests recommandés

1. **Édition de questions** :
   - Modifier un QCM, QROC, ou cas clinique
   - Vérifier les toasts de succès/erreur

2. **Gestion de cours** :
   - Créer, modifier, supprimer un cours
   - Vérifier les messages en français

3. **Gestion de matières** :
   - Supprimer une matière
   - Vérifier les confirmations et toasts

4. **Visibilité de questions** :
   - Masquer/afficher une question
   - Vérifier les messages de statut

5. **Authentification** :
   - Tenter de modifier sans être connecté
   - Vérifier les messages d'erreur
