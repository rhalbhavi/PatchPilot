# Machine Learning Pipeline & Model Lifecycle Documentation

This document provides a comprehensive overview of the backend machine learning subsystem used for vulnerability ranking and false-positive prediction.

## 1. Pipeline Overview & Architecture
The backend utilizes a multi-stage machine learning pipeline to process security scan results, extract relevant features, and generate intelligence scores.

### Data Flow
1. **Input:** Raw security scan results are captured by the backend.
2. **Feature Extraction:** Relevant text and structural metadata are extracted from files and code snippets.
3. **Embedding Generation:** Code snippets are passed through the transformer model to generate dense vector representations.
4. **Inference Stage:** Preprocessed features and embeddings are fed into the serialized models (`ranker.pkl` and `fp_classifier.pkl`).
5. **Output:** The pipeline outputs combined vulnerability ranking scores and false-positive probabilities to modify final scan views.

---

## 2. Feature Extraction & Preprocessing
The pipeline processes raw scan results into numeric features acceptable by Scikit-Learn models.
* **Location:** `backend/app/ml/ranker.py` and `backend/app/ml/fp_predictor.py`
* **Input Features:** Structural code components, severity flags, and contextual scan metadata.

---

## 3. Embedding Model
To understand code semantics, the subsystem integrates a deep learning transformer model.
* **Model Name:** `microsoft/codebert-base`
* **Purpose:** Generates high-quality semantic embeddings from raw source code patches.
* **Runtime Considerations:** 
  * The model is cached locally after the first download to prevent cold-start network latency.
  * Inference runs on CPU/GPU depending on environment availability.

---

## 4. Model Inference & Serialized Artifacts
The subsystem relies on two primary serialized Scikit-Learn models located in the backend storage:

| Model Artifact | Component Location | Purpose | Output Interpretation |
| :--- | :--- | :--- | :--- |
| `ranker.pkl` | `backend/app/ml/ranker.py` | Ranks vulnerabilities based on risk priority. | Higher scores indicate critical, urgent issues. |
| `fp_classifier.pkl` | `backend/app/ml/fp_predictor.py` | Predicts the probability of a false positive. | Probability near 1.0 flags a high-chance false positive. |

---

## 5. Model Training & Retraining Workflow
To update models as new vulnerabilities or scanners evolve, follow this lifecycle process:

### Prerequisites & Datasets
* Training requires labeled scan datasets containing confirmed vulnerabilities and verified false positives.

### Step-by-Step Retraining Execution
1. **Prepare Data:** Aggregate new raw scanner outputs into the designated training directory.
2. **Run Extraction:** Execute the feature extraction scripts to generate updated matrices.
3. **Execute Training Script:** Run the underlying model training script to re-fit the Scikit-Learn pipelines.
4. **Validation:** Review accuracy, precision, recall, and F1-scores against validation datasets.
5. **Artifact Replacement:** Save out the newly trained models as `ranker.pkl` and `fp_classifier.pkl`, replacing the old artifacts.

---

## 6. Operational Notes
* **Runtime Dependencies:** `scikit-learn`, `transformers`, `torch`
* **Offline Deployment:** Ensure `microsoft/codebert-base` is pre-downloaded or mounted into the environment cache if deploying to internet-restricted networks.
