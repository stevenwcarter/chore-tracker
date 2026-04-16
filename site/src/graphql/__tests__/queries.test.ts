import { describe, it, expect } from 'vitest';
import { DocumentNode, OperationDefinitionNode, VariableDefinitionNode } from 'graphql';
import { LIST_BONUS_CHORES, GET_WEEKLY_CHORES, GET_ALL_WEEKLY_COMPLETIONS } from '../queries';

/** Extract the scalar name from a variable definition, unwrapping NonNull if present. */
function varTypeName(varDef: VariableDefinitionNode): string {
  const t = varDef.type;
  if (t.kind === 'NonNullType') {
    const inner = t.type;
    if (inner.kind === 'NamedType') return inner.name.value;
  }
  if (t.kind === 'NamedType') return t.name.value;
  return '';
}

function getVarDef(doc: DocumentNode, varName: string): VariableDefinitionNode {
  const op = doc.definitions[0] as OperationDefinitionNode;
  const found = op.variableDefinitions?.find((v) => v.variable.name.value === varName);
  if (!found) throw new Error(`Variable $${varName} not found in query`);
  return found;
}

describe('GraphQL query scalar types', () => {
  it('LIST_BONUS_CHORES uses LocalDate for the $date variable', () => {
    const varDef = getVarDef(LIST_BONUS_CHORES, 'date');
    expect(varTypeName(varDef)).toBe('LocalDate');
  });

  it('GET_WEEKLY_CHORES uses LocalDate for $weekStartDate', () => {
    const varDef = getVarDef(GET_WEEKLY_CHORES, 'weekStartDate');
    expect(varTypeName(varDef)).toBe('LocalDate');
  });

  it('GET_ALL_WEEKLY_COMPLETIONS uses LocalDate for $weekStartDate', () => {
    const varDef = getVarDef(GET_ALL_WEEKLY_COMPLETIONS, 'weekStartDate');
    expect(varTypeName(varDef)).toBe('LocalDate');
  });
});
