import {
  type CommutatorConfig,
  CommutatorError,
  type CommutatorValidator,
  type Field,
  type NodeType,
} from "../commutator";
import type { AbstractNodeInstance } from "./types";

export class NodesRegistry<const DataTypes extends Record<string, Field<DataTypes>> = {}> {
  // Основной индекс по UUID
  private nodesByUuid: Map<string, AbstractNodeInstance<string>> = new Map();
  // Индекс по типу ноды для быстрого поиска
  private nodesByType: Map<NodeType, Set<AbstractNodeInstance<string>>> = new Map();
  // Индекс по имени (может быть несколько инстансов с одним именем)
  private nodesByName: Map<string, Set<AbstractNodeInstance<string>>> = new Map();

  constructor(
    nodes: AbstractNodeInstance<string>[] = [],
    config: CommutatorConfig<DataTypes, any, any, any, any, any>,
    validator: CommutatorValidator<DataTypes>,
  ) {
    for (const node of nodes) {
      if (!node || typeof node !== "object") {
        throw new CommutatorError("Node is invalid");
      }

      if (this.nodesByUuid.has(node.uuid)) {
        throw new CommutatorError(`Node with uuid "${node.uuid}" already exists`);
      }

      const nodeConfig = config.getNodeConfigByName(node.name);

      if (!nodeConfig) {
        throw new CommutatorError(
          `Node config for "${String(node.name)}" of type "${node.type}" not found`,
        );
      }

      if (nodeConfig.config && node.config !== undefined) {
        if (!validator.validateFieldValue(nodeConfig.config, node.config)) {
          throw new CommutatorError(
            `Invalid config for node "${String(node.name)}" of type "${node.type}"`,
          );
        }
      }

      this.addNodeInternal(node);
    }
  }

  /**
   * Добавляет ноду в реестр и обновляет все индексы
   */
  addNode(node: AbstractNodeInstance<string>): void {
    if (this.nodesByUuid.has(node.uuid)) {
      throw new Error(`Node with uuid "${node.uuid}" already exists`);
    }
    this.addNodeInternal(node);
  }

  /**
   * Внутренний метод для добавления ноды без проверки на существование
   */
  private addNodeInternal(node: AbstractNodeInstance<string>): void {
    // Основной индекс по UUID
    this.nodesByUuid.set(node.uuid, node);

    // Индекс по типу ноды
    let nodesOfType = this.nodesByType.get(node.type);
    if (!nodesOfType) {
      nodesOfType = new Set();
      this.nodesByType.set(node.type, nodesOfType);
    }
    nodesOfType.add(node);

    // Индекс по имени (может быть несколько инстансов с одним именем)
    let nodesWithName = this.nodesByName.get(node.name);
    if (!nodesWithName) {
      nodesWithName = new Set();
      this.nodesByName.set(node.name, nodesWithName);
    }
    nodesWithName.add(node);
  }

  /**
   * Удаляет ноду из реестра и обновляет все индексы
   */
  removeNode(uuid: string): void {
    const node = this.nodesByUuid.get(uuid);
    if (!node) {
      return;
    }

    // Удаляем из основного индекса
    this.nodesByUuid.delete(uuid);

    // Удаляем из индекса по имени
    const nodesWithName = this.nodesByName.get(node.name);
    if (nodesWithName) {
      nodesWithName.delete(node);
      if (nodesWithName.size === 0) {
        this.nodesByName.delete(node.name);
      }
    }

    // Удаляем из индекса по типу
    const nodesOfType = this.nodesByType.get(node.type);
    if (nodesOfType) {
      nodesOfType.delete(node);
      if (nodesOfType.size === 0) {
        this.nodesByType.delete(node.type);
      }
    }
  }

  /**
   * Обновляет ноду в реестре
   * Если изменился тип или имя, переиндексирует ноду
   */
  updateNode(
    uuid: string,
    updater: (node: AbstractNodeInstance<string>) => AbstractNodeInstance<string>,
  ): void {
    const node = this.nodesByUuid.get(uuid);
    if (!node) {
      throw new Error(`Node with uuid "${uuid}" not found`);
    }

    const oldType = node.type;
    const oldName = node.name;

    // Применяем обновление
    const updatedNode = updater(node);
    this.nodesByUuid.set(uuid, updatedNode);

    // Если изменился тип, переиндексируем
    if (updatedNode.type !== oldType) {
      // Удаляем из старого типа
      const oldNodesOfType = this.nodesByType.get(oldType);
      if (oldNodesOfType) {
        oldNodesOfType.delete(node);
        if (oldNodesOfType.size === 0) {
          this.nodesByType.delete(oldType);
        }
      }

      // Добавляем в новый тип
      let newNodesOfType = this.nodesByType.get(updatedNode.type);
      if (!newNodesOfType) {
        newNodesOfType = new Set();
        this.nodesByType.set(updatedNode.type, newNodesOfType);
      }
      newNodesOfType.add(updatedNode);
    } else {
      // Обновляем ссылку в Set (Set хранит ссылки, так что нужно удалить и добавить)
      const nodesOfType = this.nodesByType.get(updatedNode.type);
      if (nodesOfType) {
        nodesOfType.delete(node);
        nodesOfType.add(updatedNode);
      }
    }

    // Если изменилось имя, переиндексируем
    if (updatedNode.name !== oldName) {
      // Удаляем из старого имени
      const oldNodesWithName = this.nodesByName.get(oldName);
      if (oldNodesWithName) {
        oldNodesWithName.delete(node);
        if (oldNodesWithName.size === 0) {
          this.nodesByName.delete(oldName);
        }
      }

      // Добавляем в новое имя
      let newNodesWithName = this.nodesByName.get(updatedNode.name);
      if (!newNodesWithName) {
        newNodesWithName = new Set();
        this.nodesByName.set(updatedNode.name, newNodesWithName);
      }
      newNodesWithName.add(updatedNode);
    } else {
      // Имя не изменилось - обновляем ссылку в Set
      const nodesWithName = this.nodesByName.get(updatedNode.name);
      if (nodesWithName) {
        nodesWithName.delete(node);
        nodesWithName.add(updatedNode);
      }
    }
  }

  /**
   * Получает ноду по UUID
   * O(1) - использует индекс
   */
  getNodeByUuid(uuid: string): AbstractNodeInstance<string> | undefined {
    return this.nodesByUuid.get(uuid);
  }

  /**
   * Проверяет существование ноды по UUID
   * O(1) - использует индекс
   */
  hasNode(uuid: string): boolean {
    return this.nodesByUuid.has(uuid);
  }

  /**
   * Получает все ноды указанного типа
   * O(1) для получения Set, O(k) для итерации, где k - количество нод этого типа
   */
  getNodesByType(type: NodeType): AbstractNodeInstance<string>[] {
    const nodesOfType = this.nodesByType.get(type);
    if (!nodesOfType) {
      return [];
    }
    return Array.from(nodesOfType);
  }

  /**
   * Проверяет, существует ли нода с указанным именем
   * O(1) - использует индекс
   */
  hasNodeByName(name: string): boolean {
    const nodesWithName = this.nodesByName.get(name);
    return nodesWithName !== undefined && nodesWithName.size > 0;
  }

  /**
   * Получает первую ноду по имени
   * O(1) - использует индекс
   * Примечание: может быть несколько инстансов с одним именем
   */
  getNodeByName(name: string): AbstractNodeInstance<string> | undefined {
    const nodesWithName = this.nodesByName.get(name);
    if (!nodesWithName || nodesWithName.size === 0) {
      return undefined;
    }
    // Возвращаем первый найденный инстанс
    return nodesWithName.values().next().value;
  }

  /**
   * Получает все ноды с указанным именем
   * O(1) для получения Set, O(k) для итерации, где k - количество нод с этим именем
   */
  getNodesByName(name: string): AbstractNodeInstance<string>[] {
    const nodesWithName = this.nodesByName.get(name);
    if (!nodesWithName) {
      return [];
    }
    return Array.from(nodesWithName);
  }

  /**
   * Возвращает все ноды
   * O(n) - создает массив из всех нод
   */
  getAllNodes(): AbstractNodeInstance<string>[] {
    return Array.from(this.nodesByUuid.values());
  }

  /**
   * Возвращает Map всех нод (uuid -> node)
   * O(n) - создает копию Map для безопасности
   */
  getAllNodesMap(): Map<string, AbstractNodeInstance<string>> {
    return new Map(this.nodesByUuid);
  }

  /**
   * Возвращает итератор по всем нодам
   * O(1) - не создает промежуточных структур
   */
  getAllNodesIterator(): IterableIterator<AbstractNodeInstance<string>> {
    return this.nodesByUuid.values();
  }

  /**
   * Очищает реестр
   */
  clear(): void {
    this.nodesByUuid.clear();
    this.nodesByType.clear();
    this.nodesByName.clear();
  }

  /**
   * Возвращает количество нод
   * O(1)
   */
  size(): number {
    return this.nodesByUuid.size;
  }
}
