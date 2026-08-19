/**
 * MK Paper Mill — Comprehensive Categorized Units of Measurement (UOM) Catalog
 */

const UOM_CATEGORIES = [
  {
    category: 'Mass & Weight',
    units: [
      { code: 'KGS', label: 'Kilograms (KGS)', desc: 'Standard bulk weight' },
      { code: 'MT', label: 'Metric Tonnes (MT)', desc: 'Heavy furnish & waste paper (1,000 KGS)' },
      { code: 'GM', label: 'Grams (GM)', desc: 'Lab chemicals & additives' },
      { code: 'MG', label: 'Milligrams (MG)', desc: 'Precision testing & reagents' },
      { code: 'QUINTAL', label: 'Quintals (QTL)', desc: 'Bulk agricultural & agro furnish (100 KGS)' },
      { code: 'LBS', label: 'Pounds (LBS)', desc: 'Imperial measure' },
    ]
  },
  {
    category: 'Volume & Liquid Flow',
    units: [
      { code: 'LTR', label: 'Litres (LTR)', desc: 'Liquid chemicals & lubricants' },
      { code: 'ML', label: 'Millilitres (ML)', desc: 'Lab solutions & sizing test liquid' },
      { code: 'KL', label: 'Kilolitres (KL)', desc: 'Bulk water & effluent treatment (1,000 LTR)' },
      { code: 'DRUM', label: 'Drums / Barrels (DRUM)', desc: '200L chemical & oil drums' },
      { code: 'CAN', label: 'Cans (CAN)', desc: '5L / 20L liquid containers' },
      { code: 'BOTTLE', label: 'Bottles (BTL)', desc: 'Reagent & testing bottles' },
      { code: 'JAR', label: 'Jars (JAR)', desc: 'Small paste/grease containers' },
      { code: 'CYLINDER', label: 'Gas Cylinders (CYL)', desc: 'Oxygen, Acetylene, CO2 cylinders' },
      { code: 'GALLON', label: 'Gallons (GAL)', desc: 'Imperial volume (3.785 LTR)' },
    ]
  },
  {
    category: 'Count & Discrete Packages',
    units: [
      { code: 'NOS', label: 'Numbers (NOS)', desc: 'Individual discrete items / parts' },
      { code: 'PCS', label: 'Pieces (PCS)', desc: 'General piece count' },
      { code: 'SET', label: 'Sets (SET)', desc: 'Paired/grouped assemblies' },
      { code: 'PAIR', label: 'Pairs (PAIR)', desc: 'Gloves, bearings pairs' },
      { code: 'PKT', label: 'Packets (PKT)', desc: 'Welding rods, hardware packets' },
      { code: 'BOX', label: 'Boxes (BOX)', desc: 'Fasteners, electrical relays, stationary' },
      { code: 'BAG', label: 'Bags (BAG)', desc: '25kg / 50kg chemical & starch bags' },
      { code: 'CARTON', label: 'Cartons (CTN)', desc: 'Master bulk packaging' },
      { code: 'ROLL', label: 'Rolls (ROLL)', desc: 'Belts, wire mesh, insulation tape' },
      { code: 'COIL', label: 'Coils (COIL)', desc: 'Wire coils, steel strapping' },
      { code: 'BUNDLE', label: 'Bundles (BDL)', desc: 'Tubes, rods, corrugated sheets' },
      { code: 'SHT', label: 'Sheets (SHT)', desc: 'Gasket sheets, rubber packing' },
      { code: 'REAM', label: 'Reams (REAM)', desc: 'Paper reams (500 sheets)' },
      { code: 'BALE', label: 'Bales (BALE)', desc: 'Compressed waste paper / pulp bales' },
      { code: 'DOZEN', label: 'Dozens (DZN)', desc: '12-unit packs' },
      { code: 'LOT', label: 'Lots (LOT)', desc: 'Batch lots & mixed lots' },
      { code: 'TRUCK', label: 'Truckloads (TRUCK)', desc: 'Full truck consignment' },
    ]
  },
  {
    category: 'Length & Dimensions',
    units: [
      { code: 'MTR', label: 'Meters (MTR)', desc: 'Linear pipes, cables, hoses' },
      { code: 'MM', label: 'Millimeters (MM)', desc: 'Precision thickness/diameter' },
      { code: 'CM', label: 'Centimeters (CM)', desc: 'Dimension scale' },
      { code: 'INCH', label: 'Inches (INCH)', desc: 'Pipe sizes, bolt diameters' },
      { code: 'FT', label: 'Feet (FT)', desc: 'Structural length' },
      { code: 'SQM', label: 'Square Meters (SQM)', desc: 'Fabric, machine felt clothing, sheet area' },
      { code: 'SQFT', label: 'Square Feet (SQFT)', desc: 'Surface area' },
      { code: 'RUNNING_MTR', label: 'Running Meters (RMT)', desc: 'Continuous conveyor belts & felt runs' },
    ]
  }
];

const ALL_UOM_CODES = UOM_CATEGORIES.flatMap(cat => cat.units.map(u => u.code));

module.exports = {
  UOM_CATEGORIES,
  ALL_UOM_CODES
};
