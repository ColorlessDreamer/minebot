import functools
import logging
from typing import Callable

# Global debug flag
DEBUG_ENABLED = False

def debug_log(prefix: str = "") -> Callable:
    """Decorator that logs function entry/exit and parameters when DEBUG_ENABLED is True"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if not DEBUG_ENABLED:
                return func(*args, **kwargs)
            
            full_prefix = f"[{prefix}] " if prefix else ""
            logging.info(f"{full_prefix}Entering {func.__name__}")
            logging.info(f"{full_prefix}Args: {args}, Kwargs: {kwargs}")
            
            result = func(*args, **kwargs)
            
            logging.info(f"{full_prefix}Exiting {func.__name__}")
            logging.info(f"{full_prefix}Result: {result}")
            return result
        return wrapper
    return decorator

def set_debug(enabled: bool = True) -> None:
    """Toggle debug mode globally"""
    global DEBUG_ENABLED
    DEBUG_ENABLED = enabled
    level = logging.DEBUG if enabled else logging.WARNING
    logging.basicConfig(level=level, format='%(asctime)s - %(message)s')
