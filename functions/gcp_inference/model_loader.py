from google.cloud import storage
import os
import torch

# directqory to download the model files from GCS to the local file system of the Cloud Run container.
MODEL_DIR = "/tmp/models"

# being read from env variables, with a default values.
MODEL_BUCKET_NAME = os.getenv("MODEL_BUCKET_NAME", "aussie-ecolens-gcp-models")
MEGADETECTOR_MODEL_FILE = os.getenv("MEGADETECTOR_MODEL_FILE", "mdv5a.pt")
SPECIES_MODEL_FILE = os.getenv("SPECIES_MODEL_FILE", "model.pt")
LABELS_FILE = os.getenv("LABELS_FILE", "labels.txt")

# checking if GPU is available for inference, otherwise using CPU.
if torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

# defining the list of species classes that the model can predict.
SPECIES_CLASSES = ['Alectura_lathami', 'Antechinus_agilis', 'Bos_taurus', 'Burhinus_grallarius', 'Canis_familiaris', 'Chalcophaps_longirostris', 'Colluricincla_harmonica', 'Corcorax_melanorhamphos', 'Dacelo_novaeguineae', 'Dama_dama', 'Eopsaltria_australis', 'Felis_catus', 'Geopelia_humeralis', 'Gymnorhina_tibicen', 'Homo_sapiens', 'Isoodon_macrourus', 'Lepus_europaeus', 'Macropus_giganteus', 'Menura_novaehollandiae', 'Mus_musculus', 'Oryctolagus_cuniculus', 'Perameles_nasuta', 'Pitta_versicolor', 'Rattus', 'Rattus_fuscipes', 'Rattus_rattus', 'Strepera_graculina', 'Sus_scrofa', 'Tachyglossus_aculeatus', 'Thylogale_stigmatica', 'Trichosurus_caninus', 'Trichosurus_cunninghami', 'Trichosurus_vulpecula', 'Varanus_varius', 'Vombatus_ursinus', 'Vulpes_vulpes', 'Wallabia_bicolor', 'Canis_dingo', 'Capra_hircus', 'Casuarius_casuarius', 'Heteromyias_cinereifrons', 'Hypsiprymnodon_moschatus', 'Megapodius_reinwardt', 'Notamacropus_rufogriseus', 'Orthonyx_spaldingii', 'Uromys_caudimaculatus']


# cacheing the loaded model objects in memory.
species_model = None
common_name_lookup = None


def download_blob_if_missing(bucket, file_name: str) -> str:
    """
    Downloads a single file from GCS into /tmp/models if it does not already exist.
    Returns the local file path.
    """

    destination = os.path.join(MODEL_DIR, file_name)

    # If the file already exists in the Cloud Run container,
    # avoid downloading it again.
    if os.path.exists(destination):
        print(f"{file_name} already exists. Skipping download.")
        return destination

    # a blob is the GCS object representing the file in the bucket.
    blob = bucket.blob(file_name)

    # blob.download_to_filename(destination) is how its being downloaded.
    print(f"Downloading {file_name} from bucket {MODEL_BUCKET_NAME}...")
    blob.download_to_filename(destination)
    print(f"Downloaded {file_name} to {destination}")

    return destination


# downloads the model files from GCP models bucket to the local file system of the Cloud Run container.
def download_models() -> dict[str, str]:
    """
    Downloads the model files from GCP models bucket to the local file system of the Cloud Run container.
    Returns:
    A dictionary containing the local file paths of the downloaded model files.
    """
    os.makedirs(MODEL_DIR, exist_ok=True)

    # creates the client that can access GCS. 
    # In Cloud Run, the client will automatically use the service account's credentials.
    client = storage.Client()
    bucket = client.bucket(MODEL_BUCKET_NAME)

    megadetector_path = download_blob_if_missing(bucket, MEGADETECTOR_MODEL_FILE)
    species_model_path = download_blob_if_missing(bucket, SPECIES_MODEL_FILE)
    labels_path = download_blob_if_missing(bucket, LABELS_FILE)

    return {
        "megadetector_model": megadetector_path,
        "species_model": species_model_path,
        "labels": labels_path
    }

def normalize_species_key(value: str) -> str:
    """
    Normalises a scientific species name so we can compare model class names
    with labels.txt values.
    """
    return value.strip().lower().replace(" ", "_")

def load_common_name_lookup(labels_path: str) -> dict[str, str]:
    """
    Loads the labels.txt file to create a lookup dictionary that maps the normalized scientific names to common names.
    """
    lookup = {}
    
    with open(labels_path, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            parts = line.split(";")
            if len(parts) < 7:
                continue

            genus = parts[4].strip()
            species = parts[5].strip()
            common_name = parts[6].strip()

            if not genus or not common_name:
                continue

            if species:
                scientific_key = normalize_species_key(f"{genus}_{species}")
            else:
                # some classes mayb only have genus level information, so we will use the genus name as the key in those cases.
                scientific_key = normalize_species_key(genus)

            lookup[scientific_key] = common_name

    return lookup


def get_common_name(scientific_class_name: str) -> str:
    """
    Converts a model class name into a common animal name.
    """
    global common_name_lookup

    if common_name_lookup is None:
        model_paths = download_models()
        common_name_lookup = load_common_name_lookup(model_paths["labels"])

    key = normalize_species_key(scientific_class_name)

    if key in common_name_lookup:
        return common_name_lookup[key]

    # Fallback if labels.txt does not contain a matching common name.
    return scientific_class_name.replace("_", " ")


def load_species_model():
    """
    loads the species classifier model into memory.

    This is cached globally, so the model is loaded only once per warm
    Cloud Run container instance.
    """

    global species_model
    global common_name_lookup

    model_paths = download_models()

    if species_model is None:
        print("Loading species classifier model...")
        species_model = torch.load(
            model_paths["species_model"],
            map_location=DEVICE,
            weights_only=False,
        )
        species_model.eval()
        species_model.to(DEVICE)
        print("Species classifier model loaded.")

    if common_name_lookup is None:
        print("Loading common name lookup from labels.txt...")
        common_name_lookup = load_common_name_lookup(model_paths["labels"])
        print(f"Loaded {len(common_name_lookup)} common-name mappings.")

    return {
        "species_model_path": model_paths["species_model"],
        "labels_path": model_paths["labels"],
        "device": DEVICE,
        "species_model_type": str(type(species_model)),
        "class_count": len(SPECIES_CLASSES),
        "common_name_count": len(common_name_lookup),
    }

def get_species_model():
    """
    Returns the loaded species model, class list, and device.
    If the model is not already loaded, it loads it first.
    """

    global species_model

    if species_model is None:
        load_species_model()

    return species_model, SPECIES_CLASSES, DEVICE


def get_megadetector_model_path() -> str:
    """
    Returns the local path to the downloaded MegaDetector model.
    MegaDetector is being used through the megadetector library, not loaded
    directly with torch.load().
    """
    model_paths = download_models()
    return model_paths["megadetector_model"]