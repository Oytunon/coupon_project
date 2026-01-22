import logging
import sys
import json
from datetime import datetime
from shared.settings import settings

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineNo": record.lineno,
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

def setup_logging(name=None):
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    if settings.DB_ECHO: # Simple check to see if we are in dev/verbose mode, or just default to JSON
        # In production often we want JSON. For now let's use standard for dev visibility
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    else:
        # Use JSON formatter for structured logging
        formatter = JSONFormatter()
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Hijack uvicorn access log to match our format if needed, 
    # but for now basic setup is enough.
    logging.getLogger("uvicorn.access").handlers = []
    
    return root_logger
