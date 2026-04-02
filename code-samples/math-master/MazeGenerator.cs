using System;
using UnityEngine;
using System.Collections.Generic;

namespace ExpandFuncs_BHK
{
    // Grid Mapping
    public class Cell
    {
        public WallState wallState { get; } // 해당 셀이 갖고 있는 벽들
        public Vector2 position { get; } // 현재 셀의 위치 값
        public int x { get; } // 셀의 x좌표
        public int y { get; } // 셀의 y좌표

        public Cell parent = null; // for A* Algorithm, path 역추적용
        public float f; // final cost = global cost + heuristic cost
        public float g; // global cost

        // x, y with axis (비율)
        public static float xSize { get; set; }
        public static float ySize { get; set; }

        public Cell(WallState state, Vector2 pos, int x, int y)
        {
            this.wallState = state;
            this.position = pos;
            this.x = x;
            this.y = y;
        }

        public override string ToString() => $"Pos: {position}, State: {wallState}";
    }
    
    [Flags]
    public enum WallState
    {
        // 0000 -> NO WALLS
        // 1111 -> LEFT,RIGHT,UP,DOWN
        LEFT = 1, // 0001
        RIGHT = 2, // 0010
        UP = 4, // 0100
        DOWN = 8, // 1000

        VISITED = 128, // 1000 0000
    }

    public struct Position
    {
        public int X, Y;
    }

    public struct Neighbour
    {
        public Position Position;
        public WallState SharedWall;
    }

    public static class MazeGenerator
    {
        public static WallState[,] Generate(WallState[,] ignores, int width, int height)
        {
            var maze = new WallState[width, height];
            const WallState initial = WallState.RIGHT | WallState.LEFT | WallState.UP | WallState.DOWN;
            for (var i = 0; i < width; ++i)
            {
                for (var j = 0; j < height; ++j)
                {
                    if (ignores[i, j].HasFlag(WallState.VISITED))
                        maze[i, j] = ignores[i, j];
                    else
                        maze[i, j] = initial;  // 1111
                }
            }
            
            return ApplyRecursiveBacktracker(maze, width, height);
        }

        private static WallState[,] ApplyRecursiveBacktracker(WallState[,] maze, int width, int height)
        {
            var rng = new System.Random(/*seed*/);
            var positionStack = new Stack<Position>();
            var position = new Position { X = rng.Next(0, width), Y = rng.Next(0, height) };

            maze[position.X, position.Y] |= WallState.VISITED;  // 1000 1111
            positionStack.Push(position);

            while (positionStack.Count > 0)
            {
                var current = positionStack.Pop();
                var neighbours = GetUnvisitedNeighbours(current, maze, width, height);

                if (neighbours.Count <= 0) continue;
                positionStack.Push(current);

                var randIndex = rng.Next(0, neighbours.Count);
                var randomNeighbour = neighbours[randIndex];

                var nPosition = randomNeighbour.Position;
                maze[current.X, current.Y] &= ~randomNeighbour.SharedWall;
                maze[nPosition.X, nPosition.Y] &= ~GetOppositeWall(randomNeighbour.SharedWall);
                maze[nPosition.X, nPosition.Y] |= WallState.VISITED;

                positionStack.Push(nPosition);
            }

            return maze;
        }

        private static WallState GetOppositeWall(WallState wall)
        {
            switch (wall)
            {
                case WallState.UP: return WallState.DOWN;
                case WallState.DOWN: return WallState.UP;
                case WallState.RIGHT: return WallState.LEFT;
                case WallState.LEFT: return WallState.RIGHT;
                default: return WallState.LEFT;
            }
        }

        private static List<Neighbour> GetUnvisitedNeighbours(Position p, WallState[,] maze, int width, int height)
        {
            var list = new List<Neighbour>();

            if (p.X > 0) // left
            {
                if (!maze[p.X - 1, p.Y].HasFlag(WallState.VISITED))
                {
                    list.Add(new Neighbour
                    {
                        Position = new Position
                        {
                            X = p.X - 1,
                            Y = p.Y
                        },
                        SharedWall = WallState.LEFT
                    });
                }
            }

            if (p.Y > 0) // DOWN
            {
                if (!maze[p.X, p.Y - 1].HasFlag(WallState.VISITED))
                {
                    list.Add(new Neighbour
                    {
                        Position = new Position
                        {
                            X = p.X,
                            Y = p.Y - 1
                        },
                        SharedWall = WallState.DOWN
                    });
                }
            }

            if (p.Y < height - 1) // UP
            {
                if (!maze[p.X, p.Y + 1].HasFlag(WallState.VISITED))
                {
                    list.Add(new Neighbour
                    {
                        Position = new Position
                        {
                            X = p.X,
                            Y = p.Y + 1
                        },
                        SharedWall = WallState.UP
                    });
                }
            }

            if (p.X < width - 1 && !maze[p.X + 1, p.Y].HasFlag(WallState.VISITED)) // RIGHT
            {
                list.Add(new Neighbour
                {
                    Position = new Position
                    {
                        X = p.X + 1,
                        Y = p.Y
                    },
                    SharedWall = WallState.RIGHT
                });
            }

            return list;
        }
    }
}