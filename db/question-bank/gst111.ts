import { fill, mc, multi, tf, type BankQuestion } from "./types";

/** GST 111 · Communication in English */
export const GST111: BankQuestion[] = [
  // Concord
  mc("Concord", 1, "Neither the lecturer nor the students ______ aware of the change of venue.", ["was", "were", "is", "has been", "being"], 1, "With 'neither … nor', the verb agrees with the nearer subject. 'Students' is plural, so 'were'."),
  mc("Concord", 1, "Each of the boys ______ a new textbook.", ["have", "has", "are having", "were having"], 1, "'Each' is singular, so it takes the singular verb 'has'."),
  mc("Concord", 2, "The news from the faculty ______ encouraging.", ["are", "were", "is", "have been"], 2, "'News' is an uncountable noun and takes a singular verb, even though it ends in -s."),
  mc("Concord", 2, "Mathematics ______ my favourite subject.", ["are", "is", "were", "have been"], 1, "Subjects ending in -ics (mathematics, physics, economics) take a singular verb when they name a field of study."),
  mc("Concord", 2, "The committee ______ divided over the new timetable.", ["was", "is", "were", "has"], 2, "When a collective noun's members act individually or disagree, it takes a plural verb: 'the committee were divided'."),
  mc("Concord", 1, "One of my roommates ______ a laptop.", ["own", "owns", "are owning", "have owned"], 1, "The subject is 'one', which is singular; 'of my roommates' does not change the verb."),
  mc("Concord", 3, "Bread and butter ______ my usual breakfast.", ["are", "is", "were", "have been"], 1, "Two nouns joined by 'and' that form a single idea take a singular verb."),
  mc("Concord", 2, "A number of students ______ absent from the lecture.", ["was", "is", "were", "has been"], 2, "'A number of' means 'many' and takes a plural verb; 'the number of' takes a singular verb."),
  tf("Concord", 2, "'The number of applicants has risen this year' is grammatically correct.", true, "'The number of' refers to a single number, so the singular 'has' is correct."),
  mc("Concord", 3, "Not only the captain but also the players ______ been suspended.", ["has", "have", "is", "was"], 1, "With 'not only … but also', the verb agrees with the nearer subject, 'players' — so 'have'."),

  // Punctuation
  mc("Punctuation", 1, "Which sentence uses the colon correctly?", ["I need: pens, paper and ink.", "I need three things: pens, paper and ink.", "I need three: things, pens and ink.", "I: need pens, paper and ink."], 1, "A colon follows a complete clause. 'I need three things' can stand alone before the list; 'I need' cannot."),
  mc("Punctuation", 1, "Identify the correctly punctuated sentence.", ["Its time to go.", "It's time to go.", "Its' time to go.", "It is' time to go."], 1, "'It's' is the contraction of 'it is'. 'Its' (no apostrophe) shows possession."),
  mc("Punctuation", 2, "Which sentence uses the semicolon correctly?", ["I studied hard; I passed.", "I studied hard; and passed.", "I studied; hard and passed.", "Because I studied hard; I passed."], 0, "A semicolon joins two closely related independent clauses without a conjunction."),
  mc("Punctuation", 1, "Choose the correct possessive form: the books belonging to the students.", ["the student's books", "the students books", "the students' books", "the students's books"], 2, "For plural nouns ending in -s, add only an apostrophe: students'."),
  mc("Punctuation", 2, "Which sentence is correctly punctuated?", ["However I disagree.", "However, I disagree.", "However; I disagree.", "However: I disagree."], 1, "An introductory adverb like 'however' is followed by a comma."),
  mc("Punctuation", 2, "Which mark is used to show that letters have been left out of a word?", ["Hyphen", "Apostrophe", "Colon", "Dash"], 1, "The apostrophe marks omission, as in 'don't' for 'do not'."),
  mc("Punctuation", 3, "Choose the correctly punctuated direct speech.", ["\"Come here\" she said.", "\"Come here,\" she said.", "\"Come here.\" she said.", "Come here, \"she said.\""], 1, "When direct speech comes before the reporting clause, a comma goes inside the closing quotation mark."),
  tf("Punctuation", 1, "A question mark is used at the end of an indirect question, e.g. 'He asked where I lived?'", false, "Indirect (reported) questions end with a full stop: 'He asked where I lived.'"),
  fill("Punctuation", 2, "The punctuation mark that joins the parts of a compound word such as 'mother-in-law' is called a ______.", ["hyphen"], "A hyphen joins words that work together as one unit, as in 'mother-in-law' or 'well-known'."),
  mc("Punctuation", 2, "Which sentence uses commas correctly in a list?", ["We bought rice beans, and yam.", "We bought rice, beans and yam.", "We bought, rice, beans and yam.", "We bought rice beans and, yam."], 1, "Commas separate items in a list; the comma before 'and' is optional in British usage."),

  // Parts of speech
  mc("Parts of speech", 1, "Which of the following is a coordinating conjunction?", ["although", "because", "but", "unless"], 2, "Coordinating conjunctions (for, and, nor, but, or, yet, so — FANBOYS) join equal parts. The others are subordinating."),
  mc("Parts of speech", 1, "In 'She sings beautifully', the word 'beautifully' is a/an ______.", ["adjective", "adverb", "noun", "verb"], 1, "'Beautifully' modifies the verb 'sings', describing how she sings, so it is an adverb."),
  mc("Parts of speech", 2, "In 'The swimming pool is closed', 'swimming' functions as a/an ______.", ["verb", "gerund used as a modifier", "adverb", "preposition"], 1, "Here the -ing word describes the kind of pool, acting like a modifier (a gerund used attributively), not as a verb."),
  mc("Parts of speech", 1, "Which word is a preposition in 'The keys are under the table'?", ["keys", "are", "under", "table"], 2, "'Under' shows the relationship (position) between the keys and the table."),
  mc("Parts of speech", 2, "In 'Wow! That was close', 'Wow' is a/an ______.", ["interjection", "adjective", "pronoun", "conjunction"], 0, "An interjection expresses sudden feeling and stands apart from the grammar of the sentence."),
  mc("Parts of speech", 1, "Which of these is an abstract noun?", ["chair", "Lagos", "honesty", "teacher"], 2, "Abstract nouns name ideas or qualities you cannot touch, like honesty."),
  mc("Parts of speech", 2, "In 'Those are mine', 'mine' is a ______ pronoun.", ["reflexive", "possessive", "demonstrative", "relative"], 1, "'Mine' shows ownership and stands alone, so it is a possessive pronoun. 'Those' is demonstrative."),
  mc("Parts of speech", 3, "In 'The man who called you is here', 'who' is a ______ pronoun.", ["interrogative", "relative", "personal", "indefinite"], 1, "'Who' introduces a clause that describes 'the man', so it is a relative pronoun."),
  multi("Parts of speech", 2, "Select ALL the adjectives in: 'The tall student wore a red cap.'", ["tall", "student", "wore", "red", "cap"], [0, 3], "'Tall' describes the student and 'red' describes the cap; both are adjectives."),
  mc("Parts of speech", 2, "The word 'quickly' in 'He quickly finished his assignment' modifies ______.", ["he", "finished", "his", "assignment"], 1, "Adverbs usually modify verbs; 'quickly' tells how he finished."),

  // Comprehension
  mc("Comprehension", 1, "Skimming a passage means reading it to ______.", ["memorise every detail", "get the general idea quickly", "find one specific fact", "check spelling errors"], 1, "Skimming is fast reading for the gist or main idea."),
  mc("Comprehension", 1, "Scanning is best used when you want to ______.", ["understand the writer's tone", "locate specific information such as a date", "summarise the whole text", "evaluate an argument"], 1, "Scanning means moving quickly through text to find a particular word, figure or fact."),
  mc("Comprehension", 2, "The sentence that states the main idea of a paragraph is called the ______.", ["supporting sentence", "topic sentence", "concluding sentence", "transitional sentence"], 1, "The topic sentence carries the paragraph's main idea; other sentences support it."),
  mc("Comprehension", 2, "In the SQ3R reading method, the 'Q' stands for ______.", ["Quote", "Question", "Quick read", "Quality"], 1, "SQ3R: Survey, Question, Read, Recite (Recall), Review."),
  mc("Comprehension", 2, "An inference is ______.", ["a direct quotation from the text", "a conclusion drawn from clues in the text", "the title of the passage", "a summary of every paragraph"], 1, "Inference means reading between the lines: working out what the writer implies but does not state."),
  mc("Comprehension", 3, "When a writer's attitude to the subject is mocking, the tone is best described as ______.", ["sarcastic", "neutral", "objective", "sympathetic"], 0, "A mocking attitude that says the opposite of what is meant to criticise is sarcastic."),
  tf("Comprehension", 1, "A summary should include the writer's main points in your own words, without examples and details.", true, "A good summary keeps only the main ideas, expressed concisely in your own words."),
  mc("Comprehension", 2, "Which reading speed is most suitable for studying a difficult textbook chapter?", ["Skimming", "Scanning", "Slow, careful study reading", "Speed reading"], 2, "Difficult material needs slow, intensive reading with note-taking for full understanding."),
  mc("Comprehension", 2, "The 'context clue' strategy helps a reader to ______.", ["guess the meaning of unfamiliar words from surrounding words", "find the author's address", "count the paragraphs", "identify the publisher"], 0, "Surrounding words and sentences often give hints to the meaning of an unfamiliar word."),
  mc("Comprehension", 3, "Regression during reading refers to ______.", ["reading faster than normal", "unnecessarily going back to re-read words", "reading aloud", "skipping difficult words"], 1, "Regression is the habit of moving the eyes back over words already read; it slows reading."),

  // Listening skills
  mc("Listening skills", 1, "Hearing differs from listening because listening ______.", ["is automatic", "involves paying attention and interpreting", "needs no effort", "only happens in lectures"], 1, "Hearing is the physical perception of sound; listening is the active process of attending to and understanding it."),
  mc("Listening skills", 1, "Which of these is a barrier to effective listening?", ["Taking notes", "Maintaining eye contact", "Daydreaming", "Asking questions"], 2, "Daydreaming is a psychological barrier; it takes attention away from the speaker."),
  mc("Listening skills", 2, "Listening to a lecture in order to understand and remember its content is ______ listening.", ["appreciative", "informative/comprehensive", "empathic", "discriminative"], 1, "Informative (comprehensive) listening aims at understanding and retaining information."),
  mc("Listening skills", 2, "Noise from a generator outside the lecture hall is an example of a ______ barrier.", ["physical", "psychological", "semantic", "cultural"], 0, "External sounds are physical (environmental) barriers to listening."),
  mc("Listening skills", 2, "Critical listening involves ______.", ["enjoying music", "evaluating the logic and evidence of a message", "sharing the speaker's feelings", "telling sounds apart"], 1, "Critical (evaluative) listening judges the quality of arguments and evidence."),
  tf("Listening skills", 2, "Empathic listening focuses on understanding the speaker's feelings.", true, "Empathic listening is listening to understand the speaker's emotions and point of view."),
  mc("Listening skills", 1, "A good note-taking practice during lectures is to ______.", ["write down every word", "note key points, using abbreviations", "avoid writing anything", "copy only the examples"], 1, "Effective notes capture main points and keywords; abbreviations help you keep up."),
  mc("Listening skills", 3, "The Cornell note-taking system divides the page into ______.", ["two equal columns only", "a cue column, a notes area and a summary area", "five boxes", "a mind map"], 1, "Cornell notes use a narrow cue column, a wide notes column and a summary at the bottom."),
  fill("Listening skills", 2, "Listening for pleasure, for example to music or poetry, is called ______ listening.", ["appreciative"], "Appreciative listening is listening for enjoyment."),
  mc("Listening skills", 2, "Words that sound alike but differ in meaning can cause a ______ barrier to listening.", ["semantic", "physical", "physiological", "environmental"], 0, "Semantic barriers come from misunderstanding words and meanings."),

  // Library use
  mc("Library use", 1, "A library catalogue is used to ______.", ["buy books", "find out what materials a library holds and where they are", "borrow laptops", "photocopy pages"], 1, "The catalogue (now often an OPAC) lists the library's holdings and their locations."),
  mc("Library use", 2, "OPAC stands for ______.", ["Online Public Access Catalogue", "Open Print Archive Collection", "Official Public Academic Centre", "Online Paper Access Code"], 0, "OPAC is the Online Public Access Catalogue — the library's searchable computer catalogue."),
  mc("Library use", 2, "In the Library of Congress classification, call numbers begin with ______.", ["numbers only", "letters", "the author's surname", "the year of publication"], 1, "Library of Congress (LC) call numbers start with one to three letters, e.g. PE for English language."),
  mc("Library use", 2, "The Dewey Decimal Classification divides knowledge into ______ main classes.", ["5", "10", "21", "26"], 1, "Dewey uses ten main classes, 000–900."),
  mc("Library use", 1, "Which of these is a reference material?", ["A novel", "A dictionary", "A magazine story", "A comic book"], 1, "Reference materials such as dictionaries and encyclopaedias are consulted for specific information, not read cover to cover."),
  mc("Library use", 2, "A periodical is a publication that ______.", ["is published once", "appears at regular intervals", "has no author", "cannot be borrowed"], 1, "Periodicals (journals, magazines, newspapers) come out at regular intervals."),
  tf("Library use", 1, "Reference books are usually not allowed to be borrowed out of the library.", true, "Reference materials are kept for use within the library so they are always available."),
  mc("Library use", 3, "An ISBN is used to identify ______.", ["a journal article", "a book edition", "a library user", "a thesis supervisor"], 1, "The International Standard Book Number uniquely identifies a book edition. Journals use ISSN."),
  mc("Library use", 2, "Presenting another person's work as your own without acknowledgement is called ______.", ["citation", "plagiarism", "paraphrasing", "referencing"], 1, "Plagiarism is using others' words or ideas without credit; proper citation avoids it."),
  mc("Library use", 2, "A bibliography is ______.", ["a list of sources consulted for a work", "the story of an author's life", "the table of contents", "a book's index"], 0, "A bibliography lists the books and other sources used or consulted."),
];
