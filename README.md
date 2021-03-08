# Unit Evaluator

This fairly simple collection of functions and constants is used for evaluating equations and getting the output units along with the numerical answer.

## Example

```ts
import * as units from 'https://raw.githubusercontent.com/mcbobby123/unit-eval-ts/master/mod.ts';

const energy = units.evaluate`${4e8}${units.volt}*20${units.coloumb}`;

console.log(energy.toString(), units.eqUnits(energy, units.joule));

```

Output:
```
8000000000 meter^2 kilogram second^-2 true
```
