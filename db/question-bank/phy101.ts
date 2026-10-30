import { fill, mc, multi, tf, type BankQuestion } from "./types";

/** PHY 101 · General Physics I (mechanics) */
export const PHY101: BankQuestion[] = [
  // Units & dimensions
  mc("Units & dimensions", 1, "The SI unit of force is the ______.", ["joule", "newton", "watt", "pascal"], 1, "Force is measured in newtons (N = kg m s⁻²)."),
  mc("Units & dimensions", 1, "Which of these is a fundamental (base) quantity?", ["Velocity", "Mass", "Force", "Energy"], 1, "Mass is a base quantity; the others are derived."),
  mc("Units & dimensions", 2, "The dimensions of velocity are ______.", ["LT⁻¹", "LT⁻²", "MLT⁻¹", "ML²T⁻²"], 0, "Velocity = length ÷ time."),
  mc("Units & dimensions", 2, "The dimensions of force are ______.", ["MLT⁻¹", "MLT⁻²", "ML²T⁻²", "ML⁻¹T⁻²"], 1, "Force = mass × acceleration: M × LT⁻²."),
  mc("Units & dimensions", 2, "The SI unit of power is the ______.", ["joule", "watt", "newton", "volt"], 1, "Power is energy per unit time; 1 W = 1 J/s."),
  mc("Units & dimensions", 3, "The dimensions of work (energy) are ______.", ["ML²T⁻²", "MLT⁻²", "ML²T⁻³", "MLT"], 0, "Work = force × distance: MLT⁻² × L."),
  mc("Units & dimensions", 2, "1 kilometre per hour is closest to ______.", ["0.28 m/s", "3.6 m/s", "1 m/s", "10 m/s"], 0, "1 km/h = 1000 m / 3600 s ≈ 0.278 m/s."),
  tf("Units & dimensions", 1, "Temperature is one of the SI base quantities.", true, "Thermodynamic temperature (kelvin) is a base quantity."),
  multi("Units & dimensions", 2, "Select ALL the vector quantities.", ["Velocity", "Speed", "Force", "Mass", "Displacement"], [0, 2, 4], "Vectors have direction: velocity, force and displacement. Speed and mass are scalars."),
  fill("Units & dimensions", 1, "The SI unit of pressure is the ______.", ["pascal", "Pa"], "Pressure is force per area; 1 Pa = 1 N/m²."),

  // Vectors
  mc("Vectors", 1, "A vector quantity has ______.", ["magnitude only", "direction only", "both magnitude and direction", "neither"], 2, "Vectors have magnitude and direction."),
  mc("Vectors", 2, "Two forces of 3 N and 4 N act at right angles. Their resultant is ______.", ["7 N", "1 N", "5 N", "12 N"], 2, "√(3² + 4²) = 5 N."),
  mc("Vectors", 2, "The maximum resultant of forces 6 N and 8 N is ______.", ["2 N", "10 N", "14 N", "48 N"], 2, "The maximum is when they act in the same direction: 6 + 8 = 14 N."),
  mc("Vectors", 2, "The minimum resultant of forces 6 N and 8 N is ______.", ["2 N", "10 N", "14 N", "0 N"], 0, "The minimum is when they act in opposite directions: 8 − 6 = 2 N."),
  mc("Vectors", 3, "A force of 10 N acts at 60° to the horizontal. Its horizontal component is ______.", ["5 N", "8.66 N", "10 N", "0 N"], 0, "F cos 60° = 10 × 0.5 = 5 N."),
  mc("Vectors", 3, "The dot product of two perpendicular vectors is ______.", ["zero", "the product of their magnitudes", "one", "a vector"], 0, "a · b = |a||b| cos 90° = 0."),
  mc("Vectors", 2, "If a = 3i + 4j, its magnitude is ______.", ["7", "5", "12", "1"], 1, "|a| = √(9 + 16) = 5."),
  tf("Vectors", 2, "The cross product of two vectors is a scalar.", false, "The cross product is a vector perpendicular to both; the dot product is a scalar."),
  mc("Vectors", 2, "Adding vectors by placing them head to tail uses the ______.", ["triangle (polygon) law", "inverse square law", "Hooke's law", "law of moments"], 0, "The triangle (or polygon) law of vector addition."),
  fill("Vectors", 2, "Find the magnitude of the vector 6i + 8j.", ["10"], "√(36 + 64) = 10."),

  // Kinematics
  mc("Kinematics", 1, "Acceleration is the rate of change of ______.", ["distance", "velocity", "displacement", "mass"], 1, "a = Δv/Δt."),
  mc("Kinematics", 2, "A car accelerates uniformly from rest to 20 m/s in 5 s. Its acceleration is ______.", ["4 m/s²", "100 m/s²", "0.25 m/s²", "25 m/s²"], 0, "a = (20 − 0)/5 = 4 m/s²."),
  mc("Kinematics", 2, "How far does the car in the last question travel in those 5 s?", ["50 m", "100 m", "25 m", "20 m"], 0, "s = ½(u + v)t = ½(0 + 20)(5) = 50 m."),
  mc("Kinematics", 2, "A stone is dropped from rest. Its speed after 3 s is (g = 10 m/s²) ______.", ["3 m/s", "10 m/s", "30 m/s", "45 m/s"], 2, "v = gt = 10 × 3 = 30 m/s."),
  mc("Kinematics", 3, "A ball thrown straight up at 20 m/s reaches a maximum height of (g = 10 m/s²) ______.", ["10 m", "20 m", "40 m", "200 m"], 1, "v² = u² − 2gh: 0 = 400 − 20h, so h = 20 m."),
  mc("Kinematics", 2, "The slope of a velocity–time graph gives the ______.", ["displacement", "acceleration", "speed", "force"], 1, "Gradient of v–t = acceleration."),
  mc("Kinematics", 2, "The area under a velocity–time graph gives the ______.", ["acceleration", "displacement", "momentum", "force"], 1, "Area under v–t = displacement."),
  mc("Kinematics", 3, "A projectile is launched at 45° with speed 20 m/s. Its range on level ground is (g = 10 m/s²) ______.", ["20 m", "40 m", "80 m", "10 m"], 1, "R = u² sin 2θ / g = 400 × 1 / 10 = 40 m."),
  tf("Kinematics", 2, "An object moving at constant speed in a circle is accelerating.", true, "Its direction changes continuously, so its velocity changes: there is centripetal acceleration."),
  fill("Kinematics", 2, "A body starts from rest with acceleration 2 m/s². Its velocity after 6 s, in m/s, is ______.", ["12", "12 m/s"], "v = u + at = 0 + 2 × 6 = 12 m/s."),

  // Newton's laws
  mc("Newton's laws", 1, "Newton's first law is also called the law of ______.", ["acceleration", "inertia", "gravitation", "action and reaction"], 1, "A body stays at rest or in uniform motion unless a net force acts: inertia."),
  mc("Newton's laws", 1, "A net force of 10 N acts on a 2 kg mass. Its acceleration is ______.", ["5 m/s²", "20 m/s²", "12 m/s²", "0.2 m/s²"], 0, "a = F/m = 10/2 = 5 m/s²."),
  mc("Newton's laws", 2, "Momentum is the product of ______.", ["mass and acceleration", "mass and velocity", "force and time", "force and distance"], 1, "p = mv."),
  mc("Newton's laws", 2, "Impulse equals ______.", ["change in momentum", "change in energy", "mass × acceleration", "work done"], 0, "Impulse = FΔt = Δp."),
  mc("Newton's laws", 2, "Newton's third law states that for every action there is ______.", ["no reaction", "an equal and opposite reaction", "a greater reaction", "a delayed reaction"], 1, "Action and reaction are equal in size and opposite in direction, acting on different bodies."),
  mc("Newton's laws", 3, "A 1000 kg car moving at 20 m/s stops in 4 s. The average braking force is ______.", ["5000 N", "80 000 N", "2000 N", "20 000 N"], 0, "F = Δp/Δt = (1000 × 20)/4 = 5000 N."),
  mc("Newton's laws", 3, "In a closed system, total momentum ______.", ["always increases", "is conserved", "always decreases", "becomes zero"], 1, "With no external force, total momentum is conserved."),
  mc("Newton's laws", 2, "The weight of a 5 kg mass on Earth (g = 10 m/s²) is ______.", ["5 N", "50 N", "0.5 N", "500 N"], 1, "W = mg = 5 × 10 = 50 N."),
  tf("Newton's laws", 2, "Mass and weight are the same quantity.", false, "Mass is the amount of matter (kg); weight is the gravitational force on it (N)."),
  fill("Newton's laws", 2, "The momentum of a 3 kg body moving at 4 m/s, in kg m/s, is ______.", ["12"], "p = mv = 3 × 4 = 12 kg m/s."),

  // Work, energy & power
  mc("Work, energy & power", 1, "Work done is force multiplied by ______ in the direction of the force.", ["time", "displacement", "velocity", "mass"], 1, "W = F × s (in the direction of the force)."),
  mc("Work, energy & power", 2, "The kinetic energy of a 2 kg mass moving at 3 m/s is ______.", ["6 J", "9 J", "18 J", "3 J"], 1, "KE = ½mv² = ½ × 2 × 9 = 9 J."),
  mc("Work, energy & power", 2, "The potential energy of a 2 kg mass 5 m above the ground is (g = 10 m/s²) ______.", ["10 J", "50 J", "100 J", "25 J"], 2, "PE = mgh = 2 × 10 × 5 = 100 J."),
  mc("Work, energy & power", 2, "A machine does 600 J of work in 30 s. Its power is ______.", ["20 W", "18 000 W", "570 W", "0.05 W"], 0, "P = W/t = 600/30 = 20 W."),
  mc("Work, energy & power", 3, "A ball dropped from 20 m hits the ground at (g = 10 m/s², no air resistance) ______.", ["10 m/s", "20 m/s", "200 m/s", "40 m/s"], 1, "mgh = ½mv²: v = √(2gh) = √400 = 20 m/s."),
  mc("Work, energy & power", 2, "The principle of conservation of energy states that energy ______.", ["is always lost as heat", "cannot be created or destroyed", "can be created by machines", "is only kinetic"], 1, "Energy changes form but the total stays constant."),
  mc("Work, energy & power", 3, "A machine's efficiency is 80%. If 500 J of work is put in, the useful work out is ______.", ["400 J", "625 J", "100 J", "580 J"], 0, "Output = 0.8 × 500 = 400 J."),
  multi("Work, energy & power", 2, "Select ALL the forms of mechanical energy.", ["Kinetic energy", "Chemical energy", "Gravitational potential energy", "Nuclear energy"], [0, 2], "Mechanical energy is kinetic plus potential energy."),
  tf("Work, energy & power", 2, "No work is done when you push against a wall that does not move.", true, "Work requires displacement in the direction of the force."),
  fill("Work, energy & power", 2, "1 kilowatt-hour is equal to how many megajoules?", ["3.6", "3.6 MJ"], "1 kWh = 1000 W × 3600 s = 3.6 × 10⁶ J = 3.6 MJ."),

  // Gravitation
  mc("Gravitation", 1, "Newton's law of gravitation says the force between two masses is inversely proportional to ______.", ["the distance", "the square of the distance", "the product of the masses", "time"], 1, "F = Gm₁m₂/r²."),
  mc("Gravitation", 2, "If the distance between two masses doubles, the gravitational force becomes ______.", ["twice as large", "half as large", "a quarter as large", "four times as large"], 2, "F ∝ 1/r²: doubling r gives 1/4 of the force."),
  mc("Gravitation", 2, "The value of G, the universal gravitational constant, is about ______.", ["9.8 N/kg", "6.67 × 10⁻¹¹ N m² kg⁻²", "3 × 10⁸ m/s", "1.6 × 10⁻¹⁹ C"], 1, "G ≈ 6.67 × 10⁻¹¹ N m² kg⁻²."),
  mc("Gravitation", 2, "Acceleration due to gravity at the Earth's surface is approximately ______.", ["9.8 m/s²", "1.6 m/s²", "6.67 m/s²", "98 m/s²"], 0, "g ≈ 9.8 m/s² (often rounded to 10)."),
  mc("Gravitation", 3, "A geostationary satellite has an orbital period of ______.", ["1 hour", "12 hours", "24 hours", "365 days"], 2, "It orbits once every 24 hours, so it stays above the same point."),
  mc("Gravitation", 3, "Escape velocity from the Earth's surface is about ______.", ["7.9 km/s", "11.2 km/s", "3 km/s", "30 km/s"], 1, "Escape velocity ≈ 11.2 km/s."),
  mc("Gravitation", 2, "Kepler's third law relates a planet's orbital period to its ______.", ["mass", "mean distance from the Sun", "density", "temperature"], 1, "T² ∝ r³."),
  mc("Gravitation", 2, "An astronaut's mass on the Moon compared with Earth is ______.", ["less", "the same", "greater", "zero"], 1, "Mass doesn't change; weight does."),
  tf("Gravitation", 1, "Weight on the Moon is less than weight on Earth.", true, "The Moon's gravity is about 1/6 of Earth's."),
  fill("Gravitation", 2, "A body weighs 60 N on Earth. Taking the Moon's gravity as 1/6 of Earth's, its weight on the Moon in newtons is ______.", ["10", "10 N"], "60 × 1/6 = 10 N."),
];
