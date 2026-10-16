import { fill, mc, multi, tf, type BankQuestion } from "./types";

/** MTH 101 · Elementary Mathematics I */
export const MTH101: BankQuestion[] = [
  // Sets
  mc("Sets", 1, "If A = {1, 2, 3, 4} and B = {3, 4, 5}, find A ∩ B.", ["{1, 2}", "{3, 4}", "{1, 2, 3, 4, 5}", "{5}"], 1, "The intersection contains elements in both sets: 3 and 4."),
  mc("Sets", 1, "If A = {1, 2, 3, 4} and B = {3, 4, 5}, find A ∪ B.", ["{3, 4}", "{1, 2, 5}", "{1, 2, 3, 4, 5}", "{1, 2, 3, 4}"], 2, "The union contains every element in either set, listed once."),
  mc("Sets", 2, "How many subsets does a set with 4 elements have?", ["4", "8", "12", "16"], 3, "A set with n elements has 2ⁿ subsets: 2⁴ = 16."),
  mc("Sets", 2, "If n(A) = 20, n(B) = 15 and n(A ∩ B) = 5, find n(A ∪ B).", ["30", "35", "40", "25"], 0, "n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = 20 + 15 − 5 = 30."),
  mc("Sets", 1, "The set of elements in A but not in B is written as ______.", ["A ∩ B", "A ∪ B", "A − B", "B − A"], 2, "The difference A − B (or A \\ B) contains elements of A that are not in B."),
  mc("Sets", 2, "If U = {1, 2, …, 10} and A = {even numbers in U}, how many elements are in A′?", ["4", "5", "6", "10"], 1, "A = {2, 4, 6, 8, 10}, so its complement A′ = {1, 3, 5, 7, 9} has 5 elements."),
  mc("Sets", 3, "In a class of 40, 25 take Physics, 20 take Chemistry and 8 take neither. How many take both?", ["13", "12", "5", "7"], 0, "40 − 8 = 32 take at least one. 25 + 20 − both = 32, so both = 13."),
  tf("Sets", 1, "The empty set is a subset of every set.", true, "∅ has no elements, so every element of ∅ is (vacuously) in any set."),
  mc("Sets", 2, "Which of these sets is infinite?", ["{x : x is a day of the week}", "{x : x is a natural number}", "{x : x is a letter of the English alphabet}", "{x : x² = 4}"], 1, "There are infinitely many natural numbers; the others are finite."),
  fill("Sets", 2, "How many proper subsets does a set with 3 elements have?", ["7"], "There are 2³ = 8 subsets; excluding the set itself leaves 7 proper subsets."),

  // Indices & surds
  mc("Indices & surds", 1, "Simplify 2³ × 2⁴.", ["2⁷", "2¹²", "4⁷", "2¹"], 0, "When multiplying powers of the same base, add the indices: 3 + 4 = 7."),
  mc("Indices & surds", 1, "Evaluate 8^(2/3).", ["4", "16", "2", "64"], 0, "8^(1/3) = 2, then 2² = 4."),
  mc("Indices & surds", 2, "Evaluate 27^(−1/3).", ["−3", "1/3", "3", "−1/3"], 1, "27^(1/3) = 3, and the negative index gives the reciprocal: 1/3."),
  mc("Indices & surds", 2, "Simplify √50.", ["5√2", "2√5", "25√2", "10√5"], 0, "√50 = √(25 × 2) = 5√2."),
  mc("Indices & surds", 2, "Simplify √12 + √27.", ["√39", "5√3", "13√3", "6√3"], 1, "√12 = 2√3 and √27 = 3√3, so the sum is 5√3."),
  mc("Indices & surds", 3, "Rationalise 1/(√3 − 1).", ["(√3 + 1)/2", "(√3 − 1)/2", "√3 + 1", "(√3 + 1)/4"], 0, "Multiply by (√3 + 1)/(√3 + 1): denominator 3 − 1 = 2, giving (√3 + 1)/2."),
  mc("Indices & surds", 2, "Solve 2ˣ = 32.", ["4", "5", "6", "16"], 1, "32 = 2⁵, so x = 5."),
  mc("Indices & surds", 3, "Solve 9ˣ = 27.", ["3/2", "2/3", "3", "1/2"], 0, "Write both as powers of 3: 3²ˣ = 3³, so 2x = 3 and x = 3/2."),
  tf("Indices & surds", 1, "Any non-zero number raised to the power 0 equals 1.", true, "a⁰ = 1 for every a ≠ 0."),
  fill("Indices & surds", 1, "Evaluate 5⁻².", ["1/25", "0.04"], "5⁻² = 1/5² = 1/25 = 0.04."),

  // Logarithms
  mc("Logarithms", 1, "Evaluate log₂ 8.", ["2", "3", "4", "8"], 1, "2³ = 8, so log₂ 8 = 3."),
  mc("Logarithms", 1, "Evaluate log₁₀ 1000.", ["2", "3", "10", "100"], 1, "10³ = 1000."),
  mc("Logarithms", 2, "Simplify log 2 + log 5 (base 10).", ["log 7", "1", "log 10²", "0"], 1, "log 2 + log 5 = log 10 = 1."),
  mc("Logarithms", 2, "Simplify log₃ 81 − log₃ 9.", ["2", "9", "log₃ 72", "3"], 0, "log₃ (81/9) = log₃ 9 = 2."),
  mc("Logarithms", 2, "If log₅ x = 2, find x.", ["10", "25", "32", "7"], 1, "x = 5² = 25."),
  mc("Logarithms", 3, "Solve log₂ (x + 1) = 3.", ["7", "8", "5", "2"], 0, "x + 1 = 2³ = 8, so x = 7."),
  mc("Logarithms", 2, "log_a a equals ______ for any valid base a.", ["0", "1", "a", "undefined"], 1, "a¹ = a, so log_a a = 1."),
  mc("Logarithms", 3, "Express 3 log x − 2 log y as a single logarithm.", ["log (x³/y²)", "log (3x − 2y)", "log (x³y²)", "log (x/y)⁶"], 0, "3 log x = log x³ and 2 log y = log y²; subtraction gives log (x³/y²)."),
  tf("Logarithms", 2, "log (a + b) = log a + log b.", false, "The rule is log (ab) = log a + log b; there is no simple rule for log (a + b)."),
  fill("Logarithms", 1, "Evaluate log₄ 1.", ["0"], "4⁰ = 1, so log₄ 1 = 0."),

  // Quadratic equations
  mc("Quadratic equations", 1, "Solve x² − 5x + 6 = 0.", ["x = 2 or 3", "x = −2 or −3", "x = 1 or 6", "x = −1 or 6"], 0, "(x − 2)(x − 3) = 0, so x = 2 or x = 3."),
  mc("Quadratic equations", 1, "Solve x² − 9 = 0.", ["x = 3 only", "x = ±3", "x = 9", "x = ±9"], 1, "x² = 9 gives x = 3 or x = −3."),
  mc("Quadratic equations", 2, "Find the sum of the roots of 2x² − 7x + 3 = 0.", ["7/2", "−7/2", "3/2", "−3/2"], 0, "Sum of roots = −b/a = 7/2."),
  mc("Quadratic equations", 2, "Find the product of the roots of 2x² − 7x + 3 = 0.", ["7/2", "3/2", "−3/2", "3"], 1, "Product of roots = c/a = 3/2."),
  mc("Quadratic equations", 2, "The discriminant of x² + 4x + 5 = 0 is ______.", ["36", "−4", "4", "0"], 1, "b² − 4ac = 16 − 20 = −4."),
  mc("Quadratic equations", 2, "If the discriminant of a quadratic is negative, the equation has ______.", ["two equal real roots", "two distinct real roots", "no real roots", "one root only"], 2, "A negative discriminant means the roots are complex, not real."),
  mc("Quadratic equations", 3, "Find k if x² + kx + 9 = 0 has equal roots (k > 0).", ["3", "6", "9", "18"], 1, "Equal roots: k² − 36 = 0, so k = 6 (taking k > 0)."),
  mc("Quadratic equations", 3, "Which quadratic has roots 2 and −5?", ["x² + 3x − 10 = 0", "x² − 3x − 10 = 0", "x² + 3x + 10 = 0", "x² − 7x + 10 = 0"], 0, "(x − 2)(x + 5) = x² + 3x − 10."),
  multi("Quadratic equations", 2, "Select ALL the roots of x² − x − 12 = 0.", ["4", "−4", "3", "−3"], [0, 3], "(x − 4)(x + 3) = 0, so x = 4 or x = −3."),
  mc("Quadratic equations", 2, "Completing the square, x² + 6x + 2 = 0 becomes ______.", ["(x + 3)² = 7", "(x + 6)² = 34", "(x + 3)² = 11", "(x − 3)² = 7"], 0, "x² + 6x = −2; add 9: (x + 3)² = 7."),

  // Sequences & series
  mc("Sequences & series", 1, "Find the 10th term of the AP 3, 7, 11, …", ["39", "43", "40", "37"], 0, "a = 3, d = 4: T₁₀ = 3 + 9 × 4 = 39."),
  mc("Sequences & series", 2, "Find the sum of the first 20 terms of the AP 2, 5, 8, …", ["610", "620", "590", "600"], 0, "S = n/2 [2a + (n − 1)d] = 10 [4 + 57] = 610."),
  mc("Sequences & series", 1, "What is the common ratio of the GP 2, 6, 18, 54, …?", ["2", "3", "4", "6"], 1, "Each term is 3 times the one before."),
  mc("Sequences & series", 2, "Find the 6th term of the GP 3, 6, 12, …", ["96", "48", "192", "64"], 0, "T₆ = 3 × 2⁵ = 96."),
  mc("Sequences & series", 3, "Find the sum to infinity of the GP 8, 4, 2, …", ["14", "16", "12", "∞"], 1, "S∞ = a/(1 − r) = 8/(1 − 1/2) = 16."),
  mc("Sequences & series", 2, "The nth term of an AP is 5n − 2. What is the common difference?", ["−2", "3", "5", "2"], 2, "T(n+1) − T(n) = 5 for all n."),
  mc("Sequences & series", 3, "The 3rd term of an AP is 11 and the 7th term is 27. Find the first term.", ["3", "4", "5", "2"], 0, "4d = 27 − 11 = 16, so d = 4; a = 11 − 2(4) = 3."),
  tf("Sequences & series", 2, "A GP with common ratio r has a sum to infinity only when −1 < r < 1.", true, "The series converges only when |r| < 1."),
  fill("Sequences & series", 2, "Find the sum 1 + 2 + 3 + … + 100.", ["5050"], "S = n(n + 1)/2 = 100 × 101/2 = 5050."),
  mc("Sequences & series", 2, "Insert the missing term in the GP 4, __, 36 (positive term).", ["12", "16", "20", "18"], 0, "The geometric mean is √(4 × 36) = 12."),

  // Trigonometry
  mc("Trigonometry", 1, "sin 30° equals ______.", ["1/2", "√3/2", "1", "√2/2"], 0, "sin 30° = 1/2."),
  mc("Trigonometry", 1, "tan 45° equals ______.", ["0", "1", "√3", "1/√3"], 1, "tan 45° = 1."),
  mc("Trigonometry", 2, "sin²θ + cos²θ equals ______.", ["0", "1", "2", "tan θ"], 1, "This is the Pythagorean identity."),
  mc("Trigonometry", 2, "If sin θ = 3/5 and θ is acute, find cos θ.", ["4/5", "3/4", "5/4", "5/3"], 0, "cos θ = √(1 − 9/25) = 4/5."),
  mc("Trigonometry", 2, "Convert 180° to radians.", ["π/2", "π", "2π", "3π/2"], 1, "180° = π radians."),
  mc("Trigonometry", 3, "In which quadrant is sin θ positive and cos θ negative?", ["First", "Second", "Third", "Fourth"], 1, "In the second quadrant sine is positive and cosine is negative."),
  mc("Trigonometry", 2, "cos 60° equals ______.", ["√3/2", "1/2", "0", "1"], 1, "cos 60° = 1/2."),
  mc("Trigonometry", 3, "sin 2θ equals ______.", ["2 sin θ", "2 sin θ cos θ", "sin²θ − cos²θ", "1 − 2 sin θ"], 1, "Double-angle formula: sin 2θ = 2 sin θ cos θ."),
  tf("Trigonometry", 2, "cos (−θ) = −cos θ.", false, "Cosine is an even function: cos (−θ) = cos θ."),
  fill("Trigonometry", 2, "Evaluate sin 90°.", ["1"], "sin 90° = 1."),
];
