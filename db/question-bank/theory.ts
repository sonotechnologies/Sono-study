/** Sample theory questions with marking guides (brief §8): two per seeded course. */
export type TheoryItem = { topic: string; stem: string; rubric: { point: string; marks: number }[]; modelAnswer: string };

export const THEORY: Record<string, TheoryItem[]> = {
  GST111: [
    {
      topic: "Listening skills",
      stem: "Distinguish between hearing and listening, and explain three habits of an effective listener.",
      rubric: [
        { point: "Hearing is the passive, physical reception of sound", marks: 2 },
        { point: "Listening is active: attending to, interpreting and responding to the message", marks: 2 },
        { point: "Gives feedback or asks questions to check understanding", marks: 2 },
        { point: "Avoids interrupting and distractions; concentrates on the speaker", marks: 2 },
        { point: "Takes notes or summarises the main points", marks: 2 },
      ],
      modelAnswer:
        "Hearing is the passive, physical process of sound reaching the ear; listening is active, because the listener attends to, interprets and responds to the message. An effective listener gives feedback and asks questions to check understanding, avoids interrupting and shuts out distractions to concentrate on the speaker, and takes notes or summarises the main points.",
    },
    {
      topic: "Concord",
      stem: "Explain the rule of subject-verb concord and discuss two exceptions, with an example sentence for each.",
      rubric: [
        { point: "A verb agrees with its subject in number (singular subject, singular verb)", marks: 2 },
        { point: "Collective nouns take a singular verb when the group acts as one", marks: 2 },
        { point: "With either…or / neither…nor, the verb agrees with the nearer subject (proximity)", marks: 2 },
        { point: "Gives a correct example sentence for each case", marks: 2 },
      ],
      modelAnswer:
        "Subject-verb concord means the verb agrees with its subject in number: 'The student writes'. Collective nouns take a singular verb when the group acts as one: 'The committee has decided'. With either…or and neither…nor the verb agrees with the nearer subject: 'Neither the lecturer nor the students were late'.",
    },
  ],
  MTH101: [
    {
      topic: "Quadratic equations",
      stem: "Solve 2x² − 7x + 3 = 0 by factorisation and state the sum and product of the roots.",
      rubric: [
        { point: "Factorises correctly as (2x − 1)(x − 3) = 0", marks: 3 },
        { point: "Roots x = 1/2 and x = 3", marks: 2 },
        { point: "Sum of roots = 7/2 (−b/a)", marks: 1 },
        { point: "Product of roots = 3/2 (c/a)", marks: 1 },
      ],
      modelAnswer: "2x² − 7x + 3 = (2x − 1)(x − 3) = 0, so x = 1/2 or x = 3. Sum of roots = 7/2 = −b/a and product = 3/2 = c/a.",
    },
    {
      topic: "Sets",
      stem: "In a class of 40, 25 offer Mathematics and 20 offer Physics; 8 offer neither. How many offer both? Show your working with a Venn diagram description.",
      rubric: [
        { point: "Students offering at least one subject = 40 − 8 = 32", marks: 2 },
        { point: "Uses n(M ∪ P) = n(M) + n(P) − n(M ∩ P)", marks: 2 },
        { point: "Finds n(M ∩ P) = 25 + 20 − 32 = 13", marks: 2 },
      ],
      modelAnswer: "40 − 8 = 32 offer at least one subject. n(M ∪ P) = n(M) + n(P) − n(M ∩ P), so 32 = 25 + 20 − n(M ∩ P), giving 13 who offer both.",
    },
  ],
  CHM101: [
    {
      topic: "Chemical bonding",
      stem: "Explain the difference between ionic and covalent bonding, giving one example of each.",
      rubric: [
        { point: "Ionic bonding is the transfer of electrons from a metal to a non-metal", marks: 2 },
        { point: "Forms oppositely charged ions held by electrostatic attraction (e.g. NaCl)", marks: 2 },
        { point: "Covalent bonding is the sharing of electron pairs between non-metals", marks: 2 },
        { point: "Correct example of a covalent compound (e.g. H2O, CH4, Cl2)", marks: 2 },
      ],
      modelAnswer:
        "In ionic bonding a metal transfers electrons to a non-metal, forming oppositely charged ions held together by electrostatic attraction, as in sodium chloride. In covalent bonding non-metal atoms share pairs of electrons, as in water or methane.",
    },
    {
      topic: "Gas laws",
      stem: "State Boyle's law and use it to find the new volume when 200 cm³ of a gas at 1 atm is compressed to 4 atm at constant temperature.",
      rubric: [
        { point: "At constant temperature, the volume of a fixed mass of gas is inversely proportional to its pressure", marks: 2 },
        { point: "Uses P1V1 = P2V2", marks: 2 },
        { point: "New volume = 50 cm³", marks: 2 },
      ],
      modelAnswer: "Boyle's law: at constant temperature the volume of a fixed mass of gas is inversely proportional to its pressure, so P1V1 = P2V2. 1 × 200 = 4 × V2, so V2 = 50 cm³.",
    },
  ],
  MAC111: [
    {
      topic: "Functions of mass media",
      stem: "Discuss four functions of the mass media in a democratic society like Nigeria.",
      rubric: [
        { point: "Information / surveillance of the environment", marks: 2 },
        { point: "Education", marks: 2 },
        { point: "Entertainment", marks: 2 },
        { point: "Watchdog / holding government accountable (or correlation, agenda setting)", marks: 2 },
        { point: "Relates each function to Nigerian society with an example", marks: 2 },
      ],
      modelAnswer:
        "The media inform citizens about events (surveillance), educate them on issues such as health campaigns, entertain through music and drama, and act as a watchdog that holds government accountable, for example by investigating corruption.",
    },
    {
      topic: "Communication models",
      stem: "Describe Lasswell's model of communication and state one weakness of the model.",
      rubric: [
        { point: "Who says what, in which channel, to whom, with what effect", marks: 4 },
        { point: "Identifies the elements: communicator, message, medium, audience, effect", marks: 2 },
        { point: "Weakness: linear, with no feedback (or ignores noise)", marks: 2 },
      ],
      modelAnswer: "Lasswell (1948) described communication as: who says what, in which channel, to whom, with what effect. Its elements are the communicator, message, medium, audience and effect. It is linear: it leaves out feedback and noise.",
    },
  ],
  PHY101: [
    {
      topic: "Newton's laws",
      stem: "State Newton's three laws of motion and give an everyday example of the third law.",
      rubric: [
        { point: "First law: a body stays at rest or in uniform motion unless acted on by a net external force", marks: 2 },
        { point: "Second law: rate of change of momentum is proportional to the force (F = ma)", marks: 2 },
        { point: "Third law: action and reaction are equal and opposite", marks: 2 },
        { point: "Valid example (e.g. a gun recoiling, walking, a rocket)", marks: 2 },
      ],
      modelAnswer:
        "First law: a body remains at rest or in uniform motion in a straight line unless a net external force acts on it. Second law: the rate of change of momentum is proportional to the applied force, F = ma. Third law: to every action there is an equal and opposite reaction, as when a gun recoils.",
    },
    {
      topic: "Work, energy & power",
      stem: "A 60 kg student climbs 5 m of stairs in 10 s. Calculate the work done and the power developed (g = 10 m/s²).",
      rubric: [
        { point: "Work done = mgh", marks: 2 },
        { point: "Work = 60 × 10 × 5 = 3000 J", marks: 2 },
        { point: "Power = work / time = 300 W", marks: 2 },
      ],
      modelAnswer: "Work = mgh = 60 × 10 × 5 = 3000 J. Power = work ÷ time = 3000 ÷ 10 = 300 W.",
    },
  ],
};
