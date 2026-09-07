-- Diddl-Collect: News-Bilder Größen-Diagnose (nur Lesen, ändert nichts)
-- ==============================================================================
-- Zeigt, welche News-Einträge eingebettete Bilder (Data-URLs) tragen und wie
-- groß sie sind. Die Startseite lädt bis zu 50 News INKLUSIVE Bilder – jede
-- Zeile hier mit mehreren hundert KB kostet bei jedem Startseitenbesuch
-- Egress. Bei Bedarf: einzelne Bilder per
--   update public.news set bild = null where id = <id>;
-- entfernen (Text bleibt erhalten) und bei Bedarf kleiner neu hochladen.

select id, titel,
  char_length(bild) as bild_bytes,
  char_length(bild2) as bild2_bytes,
  erstellt_am
from public.news
where bild like 'data:%' or bild2 like 'data:%'
order by coalesce(char_length(bild), 0) + coalesce(char_length(bild2), 0) desc;
