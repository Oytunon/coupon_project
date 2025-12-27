# İzin verilen lig ID'leri
ALLOWED_LEAGUE_IDS: List[int] = [
    3013, 18290431, 38243, 36951, 18957, 538, 541, 18260269, 36941, 36940,
    545, 756, 686, 566, 18290799, 18278228, 35958, 35957, 19204, 1861,
    18260607, 18278410, 18290430, 18260074, 543, 18290433, 557, 1957,
    18291746, 560
]


def is_valid_bet_history_entry(bet_history: dict) -> bool:
    """Kuponun temel şartlarını kontrol eder (Kombine ve Tutar)."""
    
    bet_type = bet_history.get("Type", 0)
    if bet_type < 2:
        return False
    
    equivalent_amount = bet_history.get("EquivalentAmount", 0.0)
    if equivalent_amount < 100.0:
        return False
    
    return True


def is_valid_bet_selections(selections_data: dict) -> bool:
    """Kupon detaylarını (Oran ve Lig) kontrol eder."""
    
    data_field = selections_data.get("Data", [])
    if isinstance(data_field, list):
        selections = data_field
    elif isinstance(data_field, dict):
        selections = data_field.get("Objects", []) or data_field.get("Selections", []) or []
    else:
        selections = []
    
    if not selections:
        selections = selections_data.get("Selections", []) or []
    
    if not selections:
        return False
    
    for selection in selections:
        # Oran kontrolü
        price = selection.get("Price", 0.0)
        if price < settings.MIN_ODD:
            return False
        
        # Lig kontrolü
        competition_id = selection.get("CompetitionId")
        if competition_id is None or competition_id not in ALLOWED_LEAGUE_IDS:
            return False
    
    return True

