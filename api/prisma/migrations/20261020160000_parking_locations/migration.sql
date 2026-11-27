-- Recette du 20/10 : plusieurs emplacements par parking, et des traits
-- le long des rues (zone rouge en voirie). Les colonnes lat / lng (un
-- seul point) sont remplacées par une géométrie GeoJSON :
--   { "type": "GeometryCollection",
--     "geometries": [ { "type": "Point", "coordinates": [lng, lat] },
--                     { "type": "LineString", "coordinates": [[lng, lat], …] } ] }
-- Les parkings DÉJÀ placés gardent leur point : il est recopié dans la
-- géométrie avant la suppression des colonnes.

-- AlterTable
ALTER TABLE "Parking" ADD COLUMN "geometry" JSONB;

-- Reprise des points existants (GeoJSON : la longitude d'abord)
UPDATE "Parking"
SET "geometry" = jsonb_build_object(
  'type', 'GeometryCollection',
  'geometries', jsonb_build_array(
    jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array("lng", "lat"))
  )
)
WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL;

-- AlterTable
ALTER TABLE "Parking" DROP COLUMN "lat",
DROP COLUMN "lng";
