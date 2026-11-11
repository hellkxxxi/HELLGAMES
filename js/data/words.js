// Word lists for Helltype: the most common words of each language, lower case, separated by spaces.
// To add a language, add a list here and its name to LANGS in js/games/helltype.js.
export const WORDS = {
  en: `the be of and a to in he have it that for they with as not on she at by this we you do but from or which
one would all will there say who make when can more if no man out other so what time up go about than into could
state only new year some take come these know see use get like then first any work now may such give over think
most even find day also after way many must look before great back through long where much should well people
down own just because good each those feel seem how high too place little world very still nation hand old life
tell write become here show house both between need mean call develop under last right move thing general school
never same another begin while number part turn real leave might want point form off child few small since
against ask late home interest large person end open public follow during present without again hold govern
around possible head consider word program problem however lead system set order eye plan run keep face fact
group play stand increase early course change help line`,
  ru: `и в не на я что он с как это по но они к у ты из мы за вы так же от этот который человек о один бы такой
только себя какой когда уже для вот кто да говорить год знать мой до или если время рука нет самый ни стать
большой даже другой наш свой ну под где дело есть сам раз чтобы два там чем глаз жизнь первый день тут потом
очень хотеть ли при голова надо без видеть идти теперь тоже стоять друг дом сейчас можно после слово здесь
думать место спросить через лицо тогда ведь хороший каждый новый жить должен смотреть почему потому сторона
просто нога сидеть понять иметь конечно делать вдруг над взять никто сделать дверь перед нужно понимать работа
три ваш земля конец несколько час голос город последний пока хорошо давать вода более хотя всегда второй куда
пойти стол увидеть сила отец женщина машина случай ночь сразу мир совсем остаться вид выйти дать работать любить
старый почти ряд начало твой вопрос много война снова ответить между подумать опять белый деньги значить про
лишь минута жена правда главный страна свет ждать мать будто никогда дорога однако лежать именно окно никакой
найти писать комната часть вообще книга маленький улица решить далеко душа чуть утро считать сколько помнить
вечер пол получить народ плечо хоть сегодня вместе взгляд ходить зачем любой история наконец мысль узнать назад
общий заметить словно прошлый уйти известный давно слышать слушать бояться сын нельзя прямо долго быстро лес
пора пять имя разговор тело молодой стена красный читать право старик мама высокий путь поэтому кроме тысяча
месяц брать написать целый огромный начинать спина настоящий пусть язык точно среди сердце вести иногда мальчик
успеть небо живой смерть девушка образ забыть вокруг письмо власть пройти воздух разный просить брат затем
показать вспомнить система четыре квартира держать также любовь солдат откуда называть третий хозяин вроде
подойти поднять особенно оба бросить школа парень кровь двадцать солнце неделя послать ребята поставить встать
например шаг мужчина равно нос мало внимание капитан ухо туда сюда играть рассказать великий слишком спать
оставить войти длинный чувство молчать отвечать берег семья искать момент десять начать следующий личный труд
верить группа немного впрочем видно муж разве движение порядок ответ тихо знакомый газета помощь сильный собака
дерево снег сон смысл смеяться лето игра песня музыка огонь`,
};
for (const lang of Object.keys(WORDS)) WORDS[lang] = [...new Set(WORDS[lang].split(/\s+/).filter(Boolean))];
