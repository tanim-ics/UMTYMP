/**
 * What a screen reader should say for a bank formula: "x squared", "the square root of 25". KaTeX's MathML copy is
 * read well by some screen readers and barely by others, so the test screen labels each formula with these words.
 *
 * It reads the LaTeX subset listed in docs/CONTENT.md (rule 9). Brackets are spoken ("open bracket … close bracket")
 * and longer groups get an end marker ("…, end fraction"), so −2⁴ and (−2)⁴ never sound the same: that difference is
 * exactly what the even-power trap tests. Anything it doesn't know gives null, and the caller keeps the MathML.
 */
export function spokenMath(latex: string): string | null {
  try {
    const reader = new Reader(tokenize(latex));
    const { words } = reader.sequence(null);
    return words.join(' ').replace(/ ,/g, ',');
  } catch (error) {
    if (error instanceof Unsupported) return null;
    throw error;
  }
}

class Unsupported extends Error {}

interface Token {
  kind: 'num' | 'letter' | 'text' | 'cmd' | 'sym';
  value: string;
}

const TOKEN = /\\text\{([^}]*)\}|(\\[a-zA-Z]+|\\.)|(\d+(?:\.\d+)?|\.\d+)|([a-zA-Z])|(\s+)|(\S)/g;

function tokenize(latex: string): Token[] {
  const tokens: Token[] = [];
  for (const [, text, cmd, num, letter, space, sym] of latex.matchAll(TOKEN)) {
    if (text !== undefined) tokens.push({ kind: 'text', value: text.trim() });
    else if (cmd !== undefined) tokens.push({ kind: 'cmd', value: cmd });
    else if (num !== undefined) tokens.push({ kind: 'num', value: num });
    else if (letter !== undefined) tokens.push({ kind: 'letter', value: letter });
    else if (space === undefined && sym !== undefined) tokens.push({ kind: 'sym', value: sym });
  }
  return tokens;
}

/** Words between operands. `operand` says whether what follows a `-` is a subtraction ("minus") or a sign. */
const OPERATORS: Readonly<Record<string, { word: string; operand: boolean }>> = {
  '+': { word: 'plus', operand: false },
  '=': { word: 'equals', operand: false },
  '<': { word: 'is less than', operand: false },
  '>': { word: 'is greater than', operand: false },
  ':': { word: 'to', operand: false },
  ',': { word: ',', operand: false },
  '\\times': { word: 'times', operand: false },
  '\\cdot': { word: 'times', operand: false },
  '\\div': { word: 'divided by', operand: false },
  '\\neq': { word: 'is not equal to', operand: false },
  '\\ne': { word: 'is not equal to', operand: false },
  '\\le': { word: 'is less than or equal to', operand: false },
  '\\leq': { word: 'is less than or equal to', operand: false },
  '\\ge': { word: 'is greater than or equal to', operand: false },
  '\\geq': { word: 'is greater than or equal to', operand: false },
  '\\%': { word: 'percent', operand: true },
};

const CLOSERS: Readonly<Record<string, string>> = { '{': '}', '(': ')', '|': '|' };

/** A run of words; `simple` when it is a single number or letter, which needs no end marker. */
interface Spoken {
  words: string[];
  simple: boolean;
}

class Reader {
  private at = 0;

  /** Mutable only so an argument can take the first digit of a number (see `argument`). */
  constructor(private readonly tokens: Token[]) {}

  private take(): Token {
    const token = this.tokens[this.at];
    if (token === undefined) throw new Unsupported();
    this.at += 1;
    return token;
  }

  /** Reads up to the closing symbol (consumed), or to the end when `close` is null. */
  sequence(close: string | null): Spoken {
    const words: string[] = [];
    let operands = 0;
    let simple = true;
    let afterOperand = false;
    for (;;) {
      const token = this.tokens[this.at];
      if (token === undefined) {
        if (close !== null) throw new Unsupported();
        break;
      }
      if (close !== null && token.kind === 'sym' && token.value === close) {
        this.at += 1;
        break;
      }
      if (token.kind === 'sym' && token.value === '-') {
        this.at += 1;
        words.push(afterOperand ? 'minus' : 'negative');
        simple = false;
        afterOperand = false;
        continue;
      }
      const operator = OPERATORS[token.value];
      if (operator !== undefined && (token.kind === 'sym' || token.kind === 'cmd')) {
        this.at += 1;
        words.push(operator.word);
        simple = false;
        afterOperand = operator.operand;
        continue;
      }
      const operand = this.withPower(this.operand());
      words.push(...operand.words);
      operands += 1;
      simple = simple && operand.simple;
      afterOperand = true;
    }
    return { words, simple: simple && operands === 1 };
  }

  private operand(): Spoken {
    const token = this.take();
    switch (token.kind) {
      case 'num':
      case 'letter':
        return { words: [token.value], simple: true };
      case 'text':
        return { words: [token.value], simple: false };
      case 'cmd':
        return this.command(token.value);
      case 'sym':
        return this.group(token.value);
    }
  }

  private group(open: string): Spoken {
    const close = CLOSERS[open];
    if (close === undefined) throw new Unsupported();
    const inner = this.sequence(close);
    if (open === '{') return inner;
    if (open === '(')
      return { words: ['open bracket', ...inner.words, 'close bracket'], simple: false };
    return ended(['the absolute value of'], inner, 'end absolute value');
  }

  private command(name: string): Spoken {
    if (name === '\\frac') {
      const top = this.argument();
      const bottom = this.argument();
      if (top.simple && bottom.simple)
        return { words: [...top.words, 'over', ...bottom.words], simple: false };
      return {
        words: ['the fraction', ...top.words, 'over', ...bottom.words, ', end fraction'],
        simple: false,
      };
    }
    if (name === '\\sqrt') return ended(['the square root of'], this.argument(), 'end root');
    throw new Unsupported();
  }

  /** `{…}` or a single number or letter, as in `\frac12`. */
  private argument(): Spoken {
    const token = this.tokens[this.at];
    if (token?.kind === 'sym' && token.value === '{') {
      this.at += 1;
      return this.sequence('}');
    }
    if (token?.kind === 'letter') {
      this.at += 1;
      return { words: [token.value], simple: true };
    }
    if (token?.kind === 'num') {
      // TeX takes one character per argument: `\frac12` is one over two, `x^23` is x squared, then 3.
      const [first = '', ...rest] = token.value;
      if (rest.length > 0) this.tokens[this.at] = { kind: 'num', value: rest.join('') };
      else this.at += 1;
      return { words: [first], simple: true };
    }
    throw new Unsupported();
  }

  private withPower(base: Spoken): Spoken {
    const token = this.tokens[this.at];
    if (token?.kind !== 'sym' || token.value !== '^') return base;
    this.at += 1;
    const power = this.argument();
    const exponent = power.words.join(' ');
    if (power.simple && exponent === '2')
      return { words: [...base.words, 'squared'], simple: false };
    if (power.simple && exponent === '3') return { words: [...base.words, 'cubed'], simple: false };
    return ended([...base.words, 'to the power'], power, 'end power');
  }
}

/** Words for a construct around an inner part; a longer inner part gets an end marker so the listener knows where it stops. */
function ended(start: string[], inner: Spoken, end: string): Spoken {
  return {
    words: [...start, ...inner.words, ...(inner.simple ? [] : [`, ${end}`])],
    simple: false,
  };
}
