"""
Species classifier label list and common-name lookup.

"""

from __future__ import annotations


CLASSES: list[str] = [
    "Alectura_lathami", "Antechinus_agilis", "Bos_taurus", "Burhinus_grallarius",
    "Canis_familiaris", "Chalcophaps_longirostris", "Colluricincla_harmonica",
    "Corcorax_melanorhamphos", "Dacelo_novaeguineae", "Dama_dama",
    "Eopsaltria_australis", "Felis_catus", "Geopelia_humeralis", "Gymnorhina_tibicen",
    "Homo_sapiens", "Isoodon_macrourus", "Lepus_europaeus", "Macropus_giganteus",
    "Menura_novaehollandiae", "Mus_musculus", "Oryctolagus_cuniculus",
    "Perameles_nasuta", "Pitta_versicolor", "Rattus", "Rattus_fuscipes",
    "Rattus_rattus", "Strepera_graculina", "Sus_scrofa", "Tachyglossus_aculeatus",
    "Thylogale_stigmatica", "Trichosurus_caninus", "Trichosurus_cunninghami",
    "Trichosurus_vulpecula", "Varanus_varius", "Vombatus_ursinus", "Vulpes_vulpes",
    "Wallabia_bicolor", "Canis_dingo", "Capra_hircus", "Casuarius_casuarius",
    "Heteromyias_cinereifrons", "Hypsiprymnodon_moschatus", "Megapodius_reinwardt",
    "Notamacropus_rufogriseus", "Orthonyx_spaldingii", "Uromys_caudimaculatus",
]


COMMON_NAMES: dict[str, str] = {
    "Alectura_lathami":         "australian brushturkey",
    "Antechinus_agilis":        "agile antechinus",
    "Bos_taurus":               "cattle",
    "Burhinus_grallarius":      "bush thick-knee",
    "Canis_familiaris":         "dingo",
    "Chalcophaps_longirostris": "pacific emerald dove",
    "Colluricincla_harmonica":  "grey shrikethrush",
    "Corcorax_melanorhamphos":  "white-winged chough",
    "Dacelo_novaeguineae":      "laughing kookaburra",
    "Dama_dama":                "fallow deer",
    "Eopsaltria_australis":     "eastern yellow robin",
    "Felis_catus":              "domestic cat",
    "Geopelia_humeralis":       "bar-shouldered dove",
    "Gymnorhina_tibicen":       "australian magpie",
    "Homo_sapiens":             "human",
    "Isoodon_macrourus":        "northern brown bandicoot",
    "Lepus_europaeus":          "european hare",
    "Macropus_giganteus":       "eastern gray kangaroo",
    "Menura_novaehollandiae":   "superb lyrebird",
    "Mus_musculus":             "house mouse",
    "Oryctolagus_cuniculus":    "european rabbit",
    "Perameles_nasuta":         "long-nosed bandicoot",
    "Pitta_versicolor":         "noisy pitta",
    "Rattus":                   "rattus",
    "Rattus_fuscipes":          "australian bush rat",
    "Rattus_rattus":            "black rat",
    "Strepera_graculina":       "pied currawong",
    "Sus_scrofa":               "wild boar",
    "Tachyglossus_aculeatus":   "australian echidna",
    "Thylogale_stigmatica":     "red-legged pademelon",
    "Trichosurus_caninus":      "short-eared possum",
    "Trichosurus_cunninghami":  "mountain brushtail opossum",
    "Trichosurus_vulpecula":    "common brushtail",
    "Varanus_varius":           "lace monitor",
    "Vombatus_ursinus":         "common wombat",
    "Vulpes_vulpes":            "red fox",
    "Wallabia_bicolor":         "swamp wallaby",
    "Canis_dingo":              "dingo",
    "Capra_hircus":             "domestic goat",
    "Casuarius_casuarius":      "southern cassowary",
    "Heteromyias_cinereifrons": "grey-headed robin",
    "Hypsiprymnodon_moschatus": "musky rat kangaroo",
    "Megapodius_reinwardt":     "orange-footed scrubfowl",
    "Notamacropus_rufogriseus": "red-necked wallaby",
    "Orthonyx_spaldingii":      "northern chowchilla",
    "Uromys_caudimaculatus":    "giant white-tailed rat",
}
