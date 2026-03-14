# 📘 Cahier des Charges : Projet NotesAides

**Application de Gestion de Connaissances Intelligente (Next-Gen PKM)**

---

## 1. Présentation du Projet

### 1.1 Contexte

Dans un flux constant d'informations, la prise de note classique ne suffit plus. **NotesAides** est conçu pour transformer la prise de note passive en un système de gestion de connaissances actif, utilisant l'IA pour automatiser l'organisation et la récupération des données.

### 1.2 Objectifs

* **Centralisation** : Capturer des notes textuelles et visuelles (OCR).
* **Intelligence Hybride** : Utiliser la puissance du Cloud (LLM) et l'efficacité du Local (Rust/SLM).
* **Récupération Instantanée** : Implémenter la recherche vectorielle pour une pertinence sémantique.
* **Auto-organisation** : Génération automatique de tags, résumés et connexions entre notes.

---

## 2. Spécifications Fonctionnelles

### 2.1 Capture et Traitement (Input Pipeline)

* **Module OCR** : Reconnaissance de texte via Rust (Local) ou Gemini 1.5 Flash (Cloud) selon la complexité de l'image.
* **Résumé Automatique (Resume)** : Synthèse des notes longues pour une lecture rapide.
* **Auto-Tagging** : Extraction d'entités nommées et de mots-clés.

### 2.2 Organisation et Analyse

* **Semantic Linking** : Création automatique de liens entre notes traitant de sujets similaires.
* **Graph View** : Visualisation des connexions entre les idées.

### 2.3 Recherche Avancée

* **Vector Search** : Recherche par sens plutôt que par mot-clé exact (ex: chercher "vitesse" peut retourner des notes sur "Rust" ou "Performance").
* **Hybride Search** : Combinaison de la recherche plein texte (SQL) et vectorielle.

---

## 3. Architecture Technique (Stack)

### 3.1 Frontend & API

* **Framework UI** : Next.js (React) pour une interface réactive.
* **API Layer** : Hono (Edge-ready) pour une latence minimale.

### 3.2 Backend & Core

* **Performance** : Rust pour les modules de calcul intensif (OCR, Parsing, Traitement de données).
* **Base de Données** :
* Relationnelle (PostgreSQL/SQLite) pour les métadonnées.
* Vectorielle (Qdrant ou pgvector) pour les embeddings.



### 3.3 Intelligence Artificielle (Hybrid AI)

* **Local (Home Server)** : Utilisation de modèles SLM (Small Language Models) type Phi-3/Llama-3 via Rust/Candle pour le tagging et l'embedding de routine.
* **Cloud (API)** : 
  * **Gemini 3 Flash** : Pour l'OCR multimodal et le traitement de contextes massifs.
  * **Deepseek V3.2** : Pour le raisonnement logique complexe et la structuration des données.



---

## 4. Spécifications DevOps

* **Conteneurisation** : Docker pour l'isolation des services (Hono, Rust Worker, Vector DB).
* **Infrastructure** : Déploiement hybride entre un serveur domestique (Home Server sur laptop recyclé) et des services Cloud.
* **CI/CD** : Pipeline automatisé pour les tests unitaires (Rust/Jest) et le déploiement.

---

## 5. Livrables Attendus

1. **Prototype Fonctionnel** : Application web accessible localement.
2. **Documentation Technique** : Schéma d'architecture et documentation API.
3. **Rapport de Performance** : Comparaison des temps de réponse (Local vs Cloud).

---

## 6. Planning Prévisionnel

* **Phase 1** : Setup de l'architecture Hono/Next.js et base de données.
* **Phase 2** : Développement du moteur de recherche vectorielle en Rust.
* **Phase 3** : Intégration des API Gemini/Deepseek et logique de routage hybride.
* **Phase 4** : Tests, optimisation DevOps et rédaction du rapport final.

---

> **Note de conception** : Le choix de l'architecture hybride garantit une souveraineté des données (Data Privacy) et une optimisation drastique des coûts opérationnels.
