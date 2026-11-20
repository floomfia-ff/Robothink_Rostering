-- 10: each preschool's nearest MRT/LRT station. Travel times run to it instead of the postcode. Safe to run twice.
alter table schools add column if not exists station text;

update schools set station = v.station
from (values
  ('Adventist Schoolhouse', 'Jurong East'),
  ('MBR Creative', 'Jurong East'),
  ('MBR Cairnhill', 'Newton'),
  ('MBR Alexandra', 'Redhill'),
  ('MBR Toa Payoh (Thu)', 'Braddell'),
  ('MBR Toa Payoh (Fri)', 'Braddell'),
  ('MBR East Coast', 'Bayshore'),
  ('MBR Punggol', 'Samudera LRT'),
  ('SPL Bukit Timah', 'King Albert Park'),
  ('MBR Dover', 'Dover'),
  ('MBR Fusionopolis', 'one-north'),
  ('MBR OUE Shenton', 'Tanjong Pagar'),
  ('MBR Tanjong Pagar', 'Tanjong Pagar'),
  ('SPL Woodlands', 'Woodlands')
) as v(name, station)
where schools.name = v.name and schools.station is null;

select name, station from schools order by name;
