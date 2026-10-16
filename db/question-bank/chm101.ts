import { fill, mc, multi, tf, type BankQuestion } from "./types";

/** CHM 101 · General Chemistry I */
export const CHM101: BankQuestion[] = [
  // Atomic structure
  mc("Atomic structure", 1, "The nucleus of an atom contains ______.", ["protons and electrons", "protons and neutrons", "neutrons and electrons", "electrons only"], 1, "Protons and neutrons (nucleons) make up the nucleus; electrons occupy orbitals around it."),
  mc("Atomic structure", 1, "The atomic number of an element is the number of ______.", ["neutrons", "protons", "nucleons", "electron shells"], 1, "Atomic number (Z) is the number of protons in the nucleus."),
  mc("Atomic structure", 2, "An atom of chlorine-37 has 17 protons. How many neutrons does it have?", ["17", "20", "37", "54"], 1, "Neutrons = mass number − atomic number = 37 − 17 = 20."),
  mc("Atomic structure", 2, "Isotopes of an element have the same ______ but different ______.", ["mass number; atomic number", "number of protons; number of neutrons", "number of neutrons; number of protons", "number of electrons; number of protons"], 1, "Isotopes have the same number of protons (same element) but different numbers of neutrons."),
  mc("Atomic structure", 2, "Who discovered the electron?", ["Ernest Rutherford", "J. J. Thomson", "James Chadwick", "John Dalton"], 1, "J. J. Thomson discovered the electron in 1897 using cathode rays."),
  mc("Atomic structure", 2, "The neutron was discovered by ______.", ["James Chadwick", "Niels Bohr", "J. J. Thomson", "Robert Millikan"], 0, "James Chadwick discovered the neutron in 1932."),
  mc("Atomic structure", 3, "What is the electronic configuration of sodium (Z = 11)?", ["1s² 2s² 2p⁶ 3s¹", "1s² 2s² 2p⁷", "1s² 2s² 2p⁶ 3p¹", "1s² 2s² 2p⁵ 3s²"], 0, "Fill orbitals in order: 1s² 2s² 2p⁶ then 3s¹ for the 11th electron."),
  mc("Atomic structure", 3, "The maximum number of electrons in a p sub-shell is ______.", ["2", "6", "10", "14"], 1, "A p sub-shell has 3 orbitals, each holding 2 electrons: 6."),
  tf("Atomic structure", 2, "Rutherford's gold foil experiment showed that most of an atom is empty space.", true, "Most alpha particles passed straight through, so most of the atom is empty space with a small dense nucleus."),
  fill("Atomic structure", 2, "The maximum number of electrons in the second shell (n = 2) is ______.", ["8"], "Maximum electrons in shell n is 2n² = 2 × 4 = 8."),

  // Periodic table
  mc("Periodic table", 1, "Elements in the same group of the periodic table have the same number of ______.", ["shells", "valence electrons", "neutrons", "isotopes"], 1, "Group members share the same number of outer (valence) electrons, so they react similarly."),
  mc("Periodic table", 1, "Group 18 elements are called the ______.", ["alkali metals", "halogens", "noble gases", "transition metals"], 2, "Group 18 (He, Ne, Ar, …) are the noble gases."),
  mc("Periodic table", 2, "Across a period from left to right, atomic radius generally ______.", ["increases", "decreases", "stays the same", "doubles"], 1, "Increasing nuclear charge pulls electrons closer, so atomic radius decreases across a period."),
  mc("Periodic table", 2, "Which element is the most electronegative?", ["Oxygen", "Chlorine", "Fluorine", "Nitrogen"], 2, "Fluorine has the highest electronegativity (about 4.0 on the Pauling scale)."),
  mc("Periodic table", 2, "Down Group 1, the reactivity of the alkali metals ______.", ["decreases", "increases", "stays the same", "becomes zero"], 1, "The outer electron is further from the nucleus and more easily lost, so reactivity increases."),
  mc("Periodic table", 2, "The modern periodic table arranges elements in order of increasing ______.", ["atomic mass", "atomic number", "density", "valency"], 1, "Moseley showed that atomic number, not mass, is the basis of periodicity."),
  mc("Periodic table", 3, "First ionisation energy across Period 3 generally ______.", ["decreases", "increases", "stays constant", "falls to zero"], 1, "Increasing nuclear charge holds electrons more tightly, so ionisation energy generally rises (with small dips)."),
  multi("Periodic table", 2, "Select ALL the halogens.", ["Chlorine", "Sodium", "Bromine", "Argon", "Iodine"], [0, 2, 4], "The halogens are Group 17: fluorine, chlorine, bromine, iodine and astatine."),
  tf("Periodic table", 1, "Metals are found mainly on the left side of the periodic table.", true, "Metals occupy the left and centre; non-metals are on the right."),
  mc("Periodic table", 2, "Which of these is a transition metal?", ["Calcium", "Iron", "Aluminium", "Sodium"], 1, "Iron is a d-block (transition) element."),

  // Chemical bonding
  mc("Chemical bonding", 1, "The bond formed by transfer of electrons from one atom to another is ______.", ["covalent", "ionic", "metallic", "hydrogen"], 1, "Ionic (electrovalent) bonds form when electrons are transferred, creating oppositely charged ions."),
  mc("Chemical bonding", 1, "A covalent bond is formed by ______.", ["transfer of electrons", "sharing of electrons", "loss of protons", "attraction of neutrons"], 1, "Covalent bonds are formed when atoms share pairs of electrons."),
  mc("Chemical bonding", 2, "Which compound contains an ionic bond?", ["H₂O", "CH₄", "NaCl", "CO₂"], 2, "Sodium chloride forms from Na⁺ and Cl⁻ ions."),
  mc("Chemical bonding", 2, "The shape of a methane (CH₄) molecule is ______.", ["linear", "trigonal planar", "tetrahedral", "bent"], 2, "Four bonding pairs around carbon arrange tetrahedrally (109.5°)."),
  mc("Chemical bonding", 3, "The H–O–H bond angle in water is about ______.", ["180°", "120°", "109.5°", "104.5°"], 3, "Two lone pairs on oxygen squeeze the bond angle to about 104.5°."),
  mc("Chemical bonding", 2, "Hydrogen bonding explains why water has a ______.", ["low boiling point", "high boiling point for its size", "metallic lustre", "positive charge"], 1, "Strong hydrogen bonds between water molecules raise its boiling point."),
  mc("Chemical bonding", 2, "A dative (coordinate) bond is one in which ______.", ["both shared electrons come from one atom", "electrons are transferred", "no electrons are shared", "only protons are shared"], 0, "In a dative bond one atom donates both electrons of the shared pair, as in NH₄⁺."),
  mc("Chemical bonding", 3, "Which molecule is non-polar?", ["HCl", "H₂O", "CO₂", "NH₃"], 2, "CO₂ is linear, so its two polar C=O bonds cancel out."),
  tf("Chemical bonding", 2, "Ionic compounds generally conduct electricity when molten or dissolved in water.", true, "Free-moving ions carry charge in the molten or aqueous state."),
  fill("Chemical bonding", 2, "The number of covalent bonds a nitrogen atom forms in ammonia (NH₃) is ______.", ["3", "three"], "Nitrogen shares three electrons with three hydrogen atoms."),

  // Mole concept
  mc("Mole concept", 1, "One mole of any substance contains ______ particles.", ["6.02 × 10²³", "6.02 × 10²²", "3.01 × 10²³", "1.0 × 10²³"], 0, "Avogadro's number is about 6.02 × 10²³."),
  mc("Mole concept", 1, "The molar mass of water (H = 1, O = 16) is ______.", ["16 g/mol", "17 g/mol", "18 g/mol", "20 g/mol"], 2, "2(1) + 16 = 18 g/mol."),
  mc("Mole concept", 2, "How many moles are in 44 g of CO₂ (C = 12, O = 16)?", ["0.5", "1", "2", "44"], 1, "Molar mass of CO₂ = 44 g/mol, so 44 g is 1 mol."),
  mc("Mole concept", 2, "What mass of NaOH is in 0.5 mol (Na = 23, O = 16, H = 1)?", ["20 g", "40 g", "10 g", "80 g"], 0, "Molar mass is 40 g/mol; 0.5 × 40 = 20 g."),
  mc("Mole concept", 2, "At s.t.p., one mole of any gas occupies ______.", ["11.2 dm³", "22.4 dm³", "24.0 dm³", "1.0 dm³"], 1, "The molar volume at s.t.p. is 22.4 dm³."),
  mc("Mole concept", 3, "Concentration in mol/dm³ of 4 g of NaOH in 500 cm³ of solution is ______.", ["0.1", "0.2", "0.4", "0.8"], 1, "4 g = 0.1 mol; 0.1 mol ÷ 0.5 dm³ = 0.2 mol/dm³."),
  mc("Mole concept", 3, "In 2H₂ + O₂ → 2H₂O, how many moles of water form from 3 mol of H₂ (excess O₂)?", ["1.5", "3", "6", "2"], 1, "The mole ratio H₂ : H₂O is 2 : 2, so 3 mol H₂ gives 3 mol H₂O."),
  mc("Mole concept", 2, "The empirical formula of a compound with molecular formula C₆H₁₂O₆ is ______.", ["CH₂O", "C₂H₄O₂", "C₆H₁₂O₆", "CHO"], 0, "Divide by the highest common factor 6: CH₂O."),
  tf("Mole concept", 2, "Equal volumes of all gases at the same temperature and pressure contain equal numbers of molecules.", true, "This is Avogadro's law."),
  fill("Mole concept", 2, "How many moles are in 9 g of water (H = 1, O = 16)?", ["0.5", "1/2"], "9 g ÷ 18 g/mol = 0.5 mol."),

  // Gas laws
  mc("Gas laws", 1, "Boyle's law states that at constant temperature, the volume of a fixed mass of gas is ______ its pressure.", ["directly proportional to", "inversely proportional to", "equal to", "independent of"], 1, "PV = constant at constant temperature."),
  mc("Gas laws", 1, "Charles' law relates volume and ______ at constant pressure.", ["mass", "absolute temperature", "density", "number of moles"], 1, "V ∝ T (in kelvin) at constant pressure."),
  mc("Gas laws", 2, "Convert 27 °C to kelvin.", ["246 K", "273 K", "300 K", "327 K"], 2, "K = °C + 273 = 300 K."),
  mc("Gas laws", 2, "A gas occupies 2 dm³ at 1 atm. What is its volume at 4 atm (same temperature)?", ["8 dm³", "0.5 dm³", "2 dm³", "4 dm³"], 1, "P₁V₁ = P₂V₂: 1 × 2 = 4 × V₂, so V₂ = 0.5 dm³."),
  mc("Gas laws", 3, "A gas at 300 K occupies 3 dm³. At constant pressure, what is its volume at 400 K?", ["2.25 dm³", "4 dm³", "3.5 dm³", "5 dm³"], 1, "V₂ = V₁ × T₂/T₁ = 3 × 400/300 = 4 dm³."),
  mc("Gas laws", 2, "In the ideal gas equation PV = nRT, R is the ______.", ["rate constant", "molar gas constant", "Rydberg constant", "resistance"], 1, "R is the molar (universal) gas constant, 8.314 J mol⁻¹ K⁻¹."),
  mc("Gas laws", 3, "Graham's law states that the rate of diffusion of a gas is inversely proportional to ______.", ["its pressure", "the square root of its molar mass (density)", "its temperature", "its volume"], 1, "Rate ∝ 1/√(molar mass): lighter gases diffuse faster."),
  mc("Gas laws", 2, "Which gas diffuses fastest?", ["O₂", "CO₂", "H₂", "Cl₂"], 2, "Hydrogen has the smallest molar mass, so it diffuses fastest."),
  tf("Gas laws", 2, "Absolute zero is 0 °C.", false, "Absolute zero is 0 K, which is −273 °C."),
  fill("Gas laws", 1, "Standard temperature at s.t.p. in kelvin is ______.", ["273", "273 K", "273K"], "Standard temperature is 0 °C = 273 K."),

  // Acids, bases & salts
  mc("Acids, bases & salts", 1, "An acid is a substance that produces ______ ions in water.", ["OH⁻", "H⁺ (H₃O⁺)", "Na⁺", "Cl⁻"], 1, "Arrhenius acids release hydrogen ions (as hydronium) in water."),
  mc("Acids, bases & salts", 1, "A solution with pH 7 is ______.", ["acidic", "neutral", "alkaline", "concentrated"], 1, "pH 7 is neutral at 25 °C."),
  mc("Acids, bases & salts", 2, "Which of these is a strong acid?", ["Ethanoic acid", "Hydrochloric acid", "Carbonic acid", "Citric acid"], 1, "HCl ionises completely in water."),
  mc("Acids, bases & salts", 2, "The reaction between an acid and a base to form salt and water is called ______.", ["oxidation", "neutralisation", "hydrolysis", "esterification"], 1, "Acid + base → salt + water is neutralisation."),
  mc("Acids, bases & salts", 2, "Phenolphthalein in an alkaline solution is ______.", ["colourless", "pink", "yellow", "blue"], 1, "Phenolphthalein is colourless in acid and pink in alkali."),
  mc("Acids, bases & salts", 3, "What is the pH of a 0.01 mol/dm³ HCl solution?", ["1", "2", "12", "0.01"], 1, "[H⁺] = 10⁻² mol/dm³, so pH = 2."),
  mc("Acids, bases & salts", 2, "According to Brønsted–Lowry, a base is a ______.", ["proton donor", "proton acceptor", "electron donor", "hydroxide producer only"], 1, "Brønsted–Lowry bases accept protons (H⁺)."),
  mc("Acids, bases & salts", 3, "The salt formed when sulphuric acid reacts with sodium hydroxide is ______.", ["sodium chloride", "sodium sulphate", "sodium sulphide", "sodium sulphite"], 1, "H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O."),
  tf("Acids, bases & salts", 1, "Blue litmus paper turns red in an acid.", true, "Acids turn blue litmus red; alkalis turn red litmus blue."),
  fill("Acids, bases & salts", 2, "The gas given off when zinc reacts with dilute hydrochloric acid is ______.", ["hydrogen", "H2", "H₂", "hydrogen gas"], "Zn + 2HCl → ZnCl₂ + H₂."),
];
