// The data the map is made of. Used by the homepage Proof section and the
// about page, so both always list the same sources.

export interface DataSource {
  name: string;
  supplies: string;
  href: string;
}

export const DATA_SOURCES: DataSource[] = [
  { name: "AWS Terrain Tiles (Mapzen, Tilezen)", supplies: "Ground heights for the 3D terrain", href: "https://registry.opendata.aws/terrain-tiles/" },
  { name: "OpenStreetMap contributors", supplies: "Streets, buildings and place names", href: "https://www.openstreetmap.org/copyright" },
  { name: "OpenFreeMap", supplies: "Map tiles and the street map style", href: "https://openfreemap.org" },
  { name: "Esri World Imagery", supplies: "Satellite photos, one tap away on the map", href: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" },
];

/** Counted with the Overpass API inside the map area (120.5 to 120.7° E, 16.3 to 16.5° N). */
export const OSM_BUILDINGS = { count: 120_751, countedOn: "2026-09-22" } as const;
