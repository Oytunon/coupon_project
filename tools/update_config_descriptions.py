from shared.database import get_db_session
from shared.models.config import SystemConfig

def update_descriptions():
    db = get_db_session()
    defaults = SystemConfig.get_default_configs()
    
    print("Updating configuration descriptions...")
    updated_count = 0
    
    for default in defaults:
        key = default["key"]
        description = default["description"]
        
        config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if config:
            if config.description != description:
                print(f"Updating description for {key}:")
                print(f"  Old: {config.description}")
                print(f"  New: {description}")
                config.description = description
                updated_count += 1
        else:
            print(f"Warning: Config key '{key}' found in defaults but not in database. Skipping.")

    if updated_count > 0:
        db.commit()
        print(f"\nSuccessfully updated {updated_count} descriptions.")
    else:
        print("\nNo descriptions needed updating.")

if __name__ == "__main__":
    update_descriptions()
