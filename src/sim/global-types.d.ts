/**
 * Ambient type stubs standing in for pokemon-showdown's sim/global-types.ts.
 *
 * The extracted data files in src/data/ embed battle callbacks whose
 * signatures reference these names as globals (that is how upstream
 * pokemon-showdown declares them). Only the names actually referenced by
 * the extracted data are declared, and all are `any` aliases on purpose:
 * the callback internals of generated data are not worth type-checking,
 * and anything stricter risks thousands of spurious errors on every
 * re-extraction. Application code should keep importing its real types
 * from src/types.ts (module imports shadow these globals).
 */

type ID = any;
type BoostID = any;
type SparseBoostsTable = any;
type Pokemon = any;
type Move = any;
type ActiveMove = any;
type MoveAction = any;
type Item = any;
type Ability = any;
type Effect = any;
type Condition = any;
