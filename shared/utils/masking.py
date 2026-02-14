def mask_username(username: str) -> str:
    """
    Kullanıcı adını maskeler. Güvenlik için backend'de uygulanır.
    Örnek: "Vahit Ar" -> "V***t A*r"
    Örnek: "Ahmet" -> "A***t"
    """
    if not username or len(username) < 2:
        return username

    parts = username.split(' ')
    if len(parts) > 1:
        masked_parts = []
        for p in parts:
            if len(p) < 2:
                masked_parts.append(p)
            else:
                stars = '*' * min(len(p) - 2, 5)
                masked_parts.append(p[0] + stars + p[-1])
        return ' '.join(masked_parts)
    
    # Single word
    stars = '*' * min(len(username) - 2, 5)
    return username[0] + stars + username[-1]
