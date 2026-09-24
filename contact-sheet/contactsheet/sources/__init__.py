"""Lead sources. Each module has collect(cfg, fetcher, db, log) that yields Lead objects."""

from . import map, news, podcasts

SOURCES = {"news": news, "podcasts": podcasts, "map": map}
