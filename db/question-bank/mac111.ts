import { fill, mc, multi, tf, type BankQuestion } from "./types";

/** MAC 111 · Introduction to Mass Communication */
export const MAC111: BankQuestion[] = [
  // Communication models
  mc("Communication models", 1, "Lasswell's model of communication asks: who says what, in which channel, to whom, with what ______?", ["cost", "effect", "noise", "speed"], 1, "Harold Lasswell (1948): Who says What in Which channel to Whom with What effect."),
  mc("Communication models", 2, "The element 'noise' was introduced into communication models by ______.", ["Lasswell", "Shannon and Weaver", "Aristotle", "Berlo"], 1, "Shannon and Weaver's 1949 mathematical model added noise as anything that distorts the signal."),
  mc("Communication models", 2, "Berlo's model is commonly known as the ______ model.", ["SMCR", "ABX", "Helical", "Two-step"], 0, "David Berlo's (1960) model: Source, Message, Channel, Receiver."),
  mc("Communication models", 2, "Wilbur Schramm emphasised that communication happens where the sender's and receiver's ______ overlap.", ["channels", "fields of experience", "noises", "codes of ethics"], 1, "Schramm's model shows that shared fields of experience make understanding possible."),
  mc("Communication models", 1, "A linear model of communication is criticised mainly because it ______.", ["has too many elements", "ignores feedback", "includes noise", "uses a channel"], 1, "Linear models show one-way flow and leave out feedback from the receiver."),
  mc("Communication models", 2, "In communication, 'encoding' means ______.", ["interpreting a message", "putting ideas into symbols such as words", "blocking noise", "choosing a newspaper"], 1, "The source encodes ideas into a message using symbols; the receiver decodes them."),
  mc("Communication models", 3, "Aristotle's rhetorical model focuses on the speaker, the speech and the ______.", ["channel", "audience", "noise", "feedback loop"], 1, "Aristotle's model centres on speaker, speech and audience (plus occasion)."),
  tf("Communication models", 2, "Feedback is the receiver's response to a message.", true, "Feedback tells the sender how the message was received."),
  multi("Communication models", 2, "Select ALL the elements of Berlo's SMCR model.", ["Source", "Noise", "Message", "Channel", "Receiver"], [0, 2, 3, 4], "SMCR stands for Source, Message, Channel and Receiver. Noise belongs to Shannon and Weaver."),
  fill("Communication models", 2, "Turning received symbols back into meaning is called ______.", ["decoding"], "The receiver decodes the message to understand it."),

  // Functions of mass media
  mc("Functions of mass media", 1, "Harold Lasswell's three functions of the mass media are surveillance, correlation and ______.", ["entertainment", "transmission of culture", "advertising", "propaganda"], 1, "Lasswell (1948) named surveillance, correlation and transmission of the social heritage (culture)."),
  mc("Functions of mass media", 2, "Which function did Charles Wright add to Lasswell's three?", ["Education", "Entertainment", "Mobilisation", "Agenda setting"], 1, "Charles Wright (1960) added entertainment."),
  mc("Functions of mass media", 1, "Reporting news about an approaching flood is the ______ function of the media.", ["surveillance", "entertainment", "correlation", "socialisation"], 0, "Surveillance means watching the environment and warning society of threats."),
  mc("Functions of mass media", 2, "Editorials that explain and interpret events perform the ______ function.", ["surveillance", "correlation", "entertainment", "transmission"], 1, "Correlation is interpreting events and prescribing responses, as in editorials and commentary."),
  mc("Functions of mass media", 2, "Passing values and norms from one generation to the next through media is ______.", ["agenda setting", "transmission of culture (socialisation)", "gatekeeping", "framing"], 1, "Transmission of culture helps socialise people into society's values."),
  mc("Functions of mass media", 2, "A 'dysfunction' of mass media is ______.", ["accurate weather news", "spreading panic through exaggerated reports", "educational programmes", "public service announcements"], 1, "Dysfunctions are harmful effects, such as causing panic or narcotising audiences."),
  mc("Functions of mass media", 3, "Lazarsfeld and Merton described the 'narcotising dysfunction' as ______.", ["media causing addiction to drugs", "audiences mistaking knowing about issues for acting on them", "media refusing to report", "excess advertising"], 1, "Heavy information exposure can make people passive: they feel informed but do nothing."),
  tf("Functions of mass media", 1, "Advertising helps to fund many mass media organisations.", true, "Much commercial media revenue comes from advertising."),
  mc("Functions of mass media", 2, "Media campaigns to get citizens to vote illustrate the ______ function.", ["mobilisation", "entertainment", "status conferral", "privacy"], 0, "Mobilisation means rallying people to act for a common goal."),
  mc("Functions of mass media", 2, "When media attention makes an ordinary person well known, it is called ______.", ["status conferral", "gatekeeping", "framing", "surveillance"], 0, "Lazarsfeld and Merton called this status conferral."),

  // History of the Nigerian press
  mc("History of the Nigerian press", 1, "The first newspaper published in Nigeria was ______.", ["West African Pilot", "Iwe Irohin", "Daily Times", "Lagos Weekly Record"], 1, "Iwe Irohin was started in Abeokuta in 1859."),
  mc("History of the Nigerian press", 1, "Iwe Irohin was founded by ______.", ["Herbert Macaulay", "Rev. Henry Townsend", "Nnamdi Azikiwe", "John Payne Jackson"], 1, "The missionary Rev. Henry Townsend founded it in Abeokuta."),
  mc("History of the Nigerian press", 1, "In what year was Iwe Irohin first published?", ["1859", "1900", "1926", "1960"], 0, "Iwe Irohin first appeared in 1859."),
  mc("History of the Nigerian press", 2, "The West African Pilot was founded in 1937 by ______.", ["Obafemi Awolowo", "Nnamdi Azikiwe", "Ernest Ikoli", "Herbert Macaulay"], 1, "Nnamdi Azikiwe founded the West African Pilot, a strong nationalist paper."),
  mc("History of the Nigerian press", 2, "The Daily Times of Nigeria was established in ______.", ["1859", "1926", "1945", "1965"], 1, "The Nigerian Daily Times was founded in 1926."),
  mc("History of the Nigerian press", 2, "The Lagos Weekly Record (1891) was founded by ______.", ["John Payne Jackson", "Henry Townsend", "Lord Lugard", "Ernest Ikoli"], 0, "John Payne Jackson founded the Lagos Weekly Record, a nationalist paper."),
  mc("History of the Nigerian press", 2, "The first television station in Africa, WNTV, began broadcasting from ______ in 1959.", ["Lagos", "Ibadan", "Enugu", "Kaduna"], 1, "Western Nigeria Television started in Ibadan in October 1959."),
  mc("History of the Nigerian press", 3, "Radio broadcasting in Nigeria began in 1932 with the ______.", ["Nigerian Broadcasting Corporation", "Radio Diffusion Service (RDS)", "FRCN", "Voice of Nigeria"], 1, "The Radio Diffusion Service relayed BBC programmes in Lagos from 1932."),
  tf("History of the Nigerian press", 2, "Early Nigerian newspapers played a major role in the struggle for independence.", true, "Papers such as the Lagos Weekly Record and West African Pilot campaigned against colonial rule."),
  fill("History of the Nigerian press", 2, "The town where Iwe Irohin was published is ______.", ["Abeokuta"], "Iwe Irohin was published in Abeokuta."),

  // Media theories
  mc("Media theories", 1, "The theory that the media tell us what to think about, not what to think, is ______.", ["cultivation theory", "agenda setting", "uses and gratifications", "magic bullet"], 1, "McCombs and Shaw (1972) found that media set the public agenda."),
  mc("Media theories", 2, "The 'magic bullet' (hypodermic needle) theory assumes audiences are ______.", ["active and selective", "passive and directly affected", "opinion leaders", "experts"], 1, "It pictured media messages being 'injected' into a passive audience."),
  mc("Media theories", 2, "Uses and gratifications theory focuses on ______.", ["what media do to people", "what people do with media", "media ownership", "media laws"], 1, "It asks why people choose media and what needs they satisfy."),
  mc("Media theories", 2, "The two-step flow theory says media influence often passes through ______.", ["governments", "opinion leaders", "advertisers", "editors only"], 1, "Lazarsfeld and colleagues found ideas flow from media to opinion leaders, then to others."),
  mc("Media theories", 2, "Cultivation theory was developed by ______.", ["George Gerbner", "Marshall McLuhan", "Paul Lazarsfeld", "Elisabeth Noelle-Neumann"], 0, "Gerbner argued that heavy television viewing shapes people's view of reality."),
  mc("Media theories", 3, "The spiral of silence theory was proposed by ______.", ["Elisabeth Noelle-Neumann", "Katz and Blumler", "McCombs and Shaw", "David Manning White"], 0, "Noelle-Neumann (1974): people stay silent if they think their view is in the minority."),
  mc("Media theories", 2, "'The medium is the message' is associated with ______.", ["Marshall McLuhan", "Harold Lasswell", "Wilbur Schramm", "George Gerbner"], 0, "Marshall McLuhan argued that the medium itself shapes society."),
  mc("Media theories", 3, "Gatekeeping in news was first studied by David Manning White in 1950, building on the idea of ______.", ["Kurt Lewin", "Karl Marx", "Aristotle", "Max Weber"], 0, "Kurt Lewin coined 'gatekeeper'; White's 'Mr. Gates' study applied it to a wire editor."),
  tf("Media theories", 2, "Uses and gratifications theory sees the audience as active.", true, "It assumes people actively choose media to meet their needs."),
  mc("Media theories", 2, "Choosing which aspects of a story to emphasise is called ______.", ["framing", "surveillance", "status conferral", "cultivation"], 0, "Framing shapes how audiences understand an issue by what is emphasised."),

  // Elements of news
  mc("Elements of news", 1, "The 5Ws and H of news writing are who, what, when, where, why and ______.", ["how", "here", "whom", "hence"], 0, "A news story should answer who, what, when, where, why and how."),
  mc("Elements of news", 1, "The news writing structure that puts the most important facts first is the ______.", ["hourglass", "inverted pyramid", "chronological order", "suspended interest"], 1, "The inverted pyramid starts with the most important facts and ends with the least."),
  mc("Elements of news", 2, "The first paragraph of a news story is called the ______.", ["byline", "lead (intro)", "dateline", "caption"], 1, "The lead (intro) summarises the key facts."),
  mc("Elements of news", 2, "A fire in your own town is more newsworthy to you because of ______.", ["prominence", "proximity", "novelty", "conflict"], 1, "Proximity: events near the audience matter more to them."),
  mc("Elements of news", 2, "A story about the President attracts attention because of ______.", ["prominence", "timeliness", "proximity", "human interest"], 0, "Prominence: well-known people make news."),
  mc("Elements of news", 2, "The line that names the writer of a story is the ______.", ["dateline", "byline", "headline", "kicker"], 1, "The byline credits the reporter."),
  multi("Elements of news", 2, "Select ALL of these that are news values.", ["Timeliness", "Proximity", "Font size", "Conflict", "Page number"], [0, 1, 3], "Timeliness, proximity and conflict are news values; font size and page number are layout matters."),
  mc("Elements of news", 3, "A 'soft news' story is best described as ______.", ["breaking news about a crash", "a feature focused on human interest", "election results", "a court verdict"], 1, "Soft news covers less time-sensitive, human-interest stories."),
  tf("Elements of news", 1, "Timeliness means a story is current or recent.", true, "News must be fresh; timeliness is a key news value."),
  mc("Elements of news", 2, "Making sure facts in a story are correct before publication is called ______.", ["fact-checking (verification)", "sensationalism", "advertorial", "syndication"], 0, "Verification is the discipline of checking facts before publishing."),

  // Media ethics & regulation
  mc("Media ethics & regulation", 1, "The body that regulates broadcasting in Nigeria is the ______.", ["Nigerian Press Council", "National Broadcasting Commission", "NUJ", "NAN"], 1, "The National Broadcasting Commission (NBC), set up in 1992, licenses and regulates broadcasting."),
  mc("Media ethics & regulation", 2, "The Nigerian Press Council deals mainly with ______.", ["radio licences", "print media standards and complaints", "film censorship", "telecom licences"], 1, "The Press Council promotes standards and handles complaints about the print press."),
  mc("Media ethics & regulation", 2, "Nigeria's Freedom of Information Act was signed into law in ______.", ["1999", "2007", "2011", "2015"], 2, "The FOI Act was signed in May 2011."),
  mc("Media ethics & regulation", 2, "Publishing false statements that damage someone's reputation is ______.", ["plagiarism", "defamation", "sedition", "embargo"], 1, "Defamation (libel in print, slander in speech) harms reputation through falsehood."),
  mc("Media ethics & regulation", 2, "Accepting money to publish or kill a story violates the principle of ______.", ["integrity (no gratification)", "proximity", "objectivity of layout", "copyright"], 0, "Journalists' codes forbid accepting bribes or gratification ('brown envelope')."),
  mc("Media ethics & regulation", 3, "The Code of Ethics for Nigerian Journalists was adopted in ______ in 1998.", ["Ilorin", "Lagos", "Abuja", "Ibadan"], 0, "The code was adopted at a meeting in Ilorin in 1998."),
  tf("Media ethics & regulation", 2, "Journalists' codes of ethics generally require them to protect confidential sources.", true, "Protecting sources is a core ethical duty in most codes, including Nigeria's."),
  mc("Media ethics & regulation", 2, "Reporting rumours as fact for shock value is called ______.", ["sensationalism", "objectivity", "balance", "attribution"], 0, "Sensationalism exaggerates to attract attention at the expense of accuracy."),
  mc("Media ethics & regulation", 2, "Giving fair space to all sides of a story is called ______.", ["balance", "framing", "gatekeeping", "syndication"], 0, "Balance (fairness) means representing relevant sides."),
  fill("Media ethics & regulation", 2, "Defamation in permanent form, such as print, is called ______.", ["libel"], "Libel is written or printed defamation; slander is spoken."),
];
