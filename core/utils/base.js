
export function findEntityById(entities, id) {
  return entities.find(entity => entity.id === id);
}

