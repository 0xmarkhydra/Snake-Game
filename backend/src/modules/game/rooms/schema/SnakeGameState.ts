import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class Vector2 extends Schema {
  @type('number')
  x: number;

  @type('number')
  y: number;

  constructor(x: number = 0, y: number = 0) {
    super();
    this.x = x;
    this.y = y;
  }
}

export class Food extends Schema {
  @type('string')
  id: string;

  @type(Vector2)
  position: Vector2;

  @type('number')
  value: number;

  constructor(id: string, x: number, y: number, value: number = 1) {
    super();
    this.id = id;
    this.position = new Vector2(x, y);
    this.value = value;
  }
}

export class SnakeSegment extends Schema {
  @type(Vector2)
  position: Vector2;

  constructor(x: number, y: number) {
    super();
    this.position = new Vector2(x, y);
  }
}

export class Player extends Schema {
  @type('string')
  id: string;

  @type('string')
  name: string = '';

  @type('number')
  score: number = 0;

  @type('number')
  angle: number = 0;

  @type('number')
  speed: number = 5;

  @type('string')
  color: string;

  @type('boolean')
  alive: boolean = true;

  @type('number')
  skinId: number = 0;

  @type('number')
  kills: number = 0;

  @type('boolean')
  invulnerable: boolean = false;

  @type('number')
  credit: number = 0;

  segments = new ArraySchema<SnakeSegment>();

  @type('number')
  totalLength: number = 5;

  @type('boolean')
  boosting: boolean = false;

  @type('number')
  boostTime: number = 0;

  @type(Vector2)
  headPosition: Vector2;

  constructor(id: string, name: string, x: number, y: number, color: string) {
    super();
    this.id = id;
    this.name = name;
    this.color = color;
    this.totalLength = 5;
    this.headPosition = new Vector2(x, y);

    for (let index = 0; index < 5; index += 1) {
      this.segments.push(new SnakeSegment(x - index * 20, y));
    }
  }

  get head(): Vector2 {
    return this.segments[0].position;
  }

  addSegment(): void {
    const lastSegment = this.segments[this.segments.length - 1];
    const newSegment = new SnakeSegment(
      lastSegment.position.x,
      lastSegment.position.y,
    );
    this.segments.push(newSegment);
    this.totalLength += 1;
  }

  reduceLength(amount: number): void {
    if (amount <= 0) {
      return;
    }

    this.totalLength = Math.max(5, this.totalLength - amount);
    const targetSegments = Math.max(5, Math.floor(this.totalLength));

    while (this.segments.length > targetSegments) {
      this.segments.pop();
    }
  }

  updateHeadPosition(): void {
    if (this.segments.length === 0) {
      return;
    }

    this.headPosition.x = this.segments[0].position.x;
    this.headPosition.y = this.segments[0].position.y;
  }
}

export class SnakeGameState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  foods = new MapSchema<Food>();

  @type('number')
  worldWidth: number = 5000;

  @type('number')
  worldHeight: number = 5000;

  @type('number')
  maxFoods: number = 620; // Balanced amount for good gameplay experience

  @type('number')
  tickRate: number = 16;

  @type('boolean')
  worldBoundaryCollisions: boolean = true;

  @type('number')
  timestamp: number = 0;
}
