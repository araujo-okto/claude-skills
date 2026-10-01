import { ConflictError, NotFoundError } from "../../shared/errors.js";

export class ItemNotFoundError extends NotFoundError {
  constructor() {
    super("Item not found.", "ITEM_NOT_FOUND");
  }
}

export class ItemNameInUseError extends ConflictError {
  constructor() {
    super("An item with this name already exists.", "ITEM_NAME_IN_USE");
  }
}

export class ItemChangedError extends ConflictError {
  constructor() {
    super(
      "The item was changed by someone else. Reload and try again.",
      "ITEM_CHANGED",
    );
  }
}
