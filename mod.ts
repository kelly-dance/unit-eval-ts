export class NumberUnit {
  value: number;
  units: Record<string, number>;

  constructor(value: number, units: Record<string, number> = {}){
    this.value = value;
    this.units = { ...units };
  }

  toString(){
    return `${this.value} ${Object.entries(this.units).sort((a,b) => b[1] - a[1]).map(([key, val]) => val === 1 ? key : `${key}^${val}`).join(' ')}`
  }
}

export const simplifyUnits = (units: Record<string, number>): Record<string, number> => {
  const copy = { ...units };
  for(const key in units){
    if(copy[key] === 0) delete copy[key];
  }
  return copy;
}

export const add = (a: NumberUnit | number, b: NumberUnit | number): NumberUnit => {
  const an = typeof a === 'number' ? new NumberUnit(a) : a;
  const bn = typeof b === 'number' ? new NumberUnit(b) : b;
  if(!eqUnits(an,bn)) throw new Error('Can not add things of different types');
  return new NumberUnit(an.value + bn.value, an.units);
}

export const sub = (a: NumberUnit | number, b: NumberUnit | number): NumberUnit => {
  const an = typeof a === 'number' ? new NumberUnit(a) : a;
  const bn = typeof b === 'number' ? new NumberUnit(b) : b;
  if(!eqUnits(an,bn)) throw new Error('Can not subtract things of different types');
  return new NumberUnit(an.value - bn.value, an.units);
}

export const mult = (a: NumberUnit | number, b: NumberUnit | number): NumberUnit => {
  const an = typeof a === 'number' ? new NumberUnit(a) : a;
  const bn = typeof b === 'number' ? new NumberUnit(b) : b;
  const newUnits: Record<string, number> = {};
  for(const key in an.units) newUnits[key] = (newUnits[key] || 0) + an.units[key];
  for(const key in bn.units) newUnits[key] = (newUnits[key] || 0) + bn.units[key];
  return new NumberUnit(an.value * bn.value, simplifyUnits(newUnits));
}

export const div = (a: NumberUnit | number, b: NumberUnit | number): NumberUnit => {
  const an = typeof a === 'number' ? new NumberUnit(a) : a;
  const bn = typeof b === 'number' ? new NumberUnit(b) : b;
  const newUnits: Record<string, number> = {};
  for(const key in an.units) newUnits[key] = (newUnits[key] || 0) + an.units[key];
  for(const key in bn.units) newUnits[key] = (newUnits[key] || 0) - bn.units[key];
  return new NumberUnit(an.value / bn.value, simplifyUnits(newUnits));
}

export const pow = (a: NumberUnit | number, b: number | NumberUnit): NumberUnit => {
  const an = typeof a === 'number' ? new NumberUnit(a) : a;
  const newUnits = Object.fromEntries(Object.entries(an.units).map(([key, val]) => [key, val * (typeof b === 'number' ? b : b.value)]));
  return new NumberUnit(an.value ** (typeof b === 'number' ? b : b.value), simplifyUnits(newUnits));
}

export const eqUnits = (a: NumberUnit | number, b: NumberUnit | number): boolean => {
  const an = typeof a === 'number' ? new NumberUnit(a) : a;
  const bn = typeof b === 'number' ? new NumberUnit(b) : b;
  const tags = [...new Set([...Object.keys(an.units), ...Object.keys(bn.units)])];
  return tags.every(tag => (an.units[tag] || 0) === (bn.units[tag] || 0));
}

export const evaluate = (ops: TemplateStringsArray, ...values: (NumberUnit | number)[]): NumberUnit => {
  const processedValues = values.map(v => typeof v === 'number' ? new NumberUnit(v) : v);
  const parsedScalars = ops.map(s => {
    s = s.replaceAll(/\s/g, '');
    const result: (string | NumberUnit)[] = [];
    while(s.length){
      const prev = result[result.length-1];
      const numMatch = s.match(((typeof prev === 'string' && prev !== ')') || !prev) ? /^-?(\d|\.)+/ : /^(\d|\.)+/);
      if(numMatch){
        result.push(new NumberUnit(parseFloat(numMatch[0])));
        s = s.substring(numMatch[0].length);
      }else if(/^\w/.test(s)){
        let i = 1;
        for( ; i < s.length; i++) if(!/^\w/.test(s.substring(i))) break;
        result.push(new NumberUnit(1, {[s.substring(0, i)]: 1}));
        s = s.substring(i);
      }else{
        result.push(s.charAt(0));
        s = s.substring(1);
      }
    }
    return result;
  });
  const merged: ((string | NumberUnit)[] | NumberUnit)[] = [parsedScalars[0]];
  for(let i = 0; i < processedValues.length; i++) merged.push(processedValues[i], parsedScalars[i+1]);
  const tokens: (string | NumberUnit)[] = merged.flat(1);
  const helper = (tokens: (string | NumberUnit)[], start: number = 0): [result: NumberUnit, end: number] => {
    let temp: (string | NumberUnit)[] = [];

    // evaluate parens
    let i = start;
    for( ; i < tokens.length; i++){
      const cur = tokens[i];
      if(cur === ')') break;
      if(cur === '(') {
        const result = helper(tokens, i + 1);
        i = result[1];
        temp.push(result[0]);
        continue;
      }
      temp.push(cur);
    }
    // console.log(temp)

    const processStage = (tokens: (string | NumberUnit)[], stage: {[x: string]: (a: NumberUnit, b: NumberUnit) => NumberUnit}): ((string | NumberUnit)[]) => { 
      const newTokens: (string | NumberUnit)[] = [...tokens];
      
      while(true){
        let hit = false;
        for(let i = 1; i < newTokens.length-1; i ++){
          const op = newTokens[i];
          if(typeof op !== 'string') continue;
          if(op in stage) {
            hit = true;
            const vals: [NumberUnit, NumberUnit] = [newTokens[i-1], newTokens[i+1]].map(v => {
              if(typeof v === 'string') throw new Error('Invalid equation');
              return v;
            }) as any;
            newTokens[i-1] = stage[op](...vals);
            newTokens.splice(i, 2);
            break;
          }
        } 
        if(!hit) break;
      }
      return newTokens;
    }

    temp = processStage(temp, {
      '^': pow,
    });

    const impliedMult: (string | NumberUnit)[] = [temp[0]];
    for(let i = 1; i < temp.length; i++) {
      if(typeof impliedMult[impliedMult.length-1] === 'object' && typeof temp[i] === 'object')
        impliedMult[impliedMult.length-1] = mult(impliedMult[impliedMult.length-1] as NumberUnit, temp[i] as NumberUnit)
      else impliedMult.push(temp[i])
    }
    // console.log(impliedMult)
    temp = impliedMult;

    temp = processStage(temp, {
      '*': mult,
      '/': div,
    });

    temp = processStage(temp, {
      '+': add,
      '-': sub,
    });

    
    if(temp.length !== 1) throw new Error('Invalid equation');

    return [temp[0] as NumberUnit, i];
  }
  return helper(tokens)[0];
}

// Base units
export const meter = new NumberUnit(1, {meter:1});
export const second = new NumberUnit(1, {second:1});
export const kilogram = new NumberUnit(1, {kilogram:1});
export const ampere = new NumberUnit(1, {ampere: 1});
export const kelvin = new NumberUnit(1, {kelvin: 1});
export const mole = new NumberUnit(1, {mole: 1});
export const candela = new NumberUnit(1, {candela: 1});

// Convenient
export const kilometer = mult(meter, 1000);
export const gram = div(kilogram, 1000);

// Derived
export const area = pow(meter, 2);
export const volume = pow(meter, 3);
export const speed = div(meter, second);
export const acceleration = div(speed, second);
export const density = div(gram, volume);
export const frequency = pow(second, -1);
export const coloumb = mult(ampere, second);
export const joule = evaluate`kilogram*meter^2second^-2`;
export const newton = evaluate`kilogram*meter*second^-2`;
export const volt = div(joule, coloumb);
export const fieldStrength = div(volt, meter);
export const farad = evaluate`second^4ampere^2kilogram^-1meter^-2`;

// Constants
export const electron = {
  mass: mult(9.10938356e-31, kilogram),
  charge: mult(1.60217662e-19, coloumb),
}
export const electronVolt = mult(electron.charge.value, joule);
export const lightspeed = mult(299792458, speed);
export const epsilonNaught = evaluate`${8.854187817e-12}${farad}${meter}^-1`
export const k = evaluate`1/4${Math.PI}${epsilonNaught}`
