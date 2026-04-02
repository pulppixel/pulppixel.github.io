using System.Linq;
using System.Collections.Generic;
using UnityEngine;

namespace ExpandFuncs_BHK
{
    public class MazePathFinder
    {
        private const float Infinity = float.MaxValue;

        // 길찾기 알고리즘으로 경로를 반환..
        public static Cell[] GetAStarPath(Cell[,] cells, Vector3 start, Vector3 destination)
        {
            // 시작점, 끝점 정하기
            var from = GetCurrentCell(cells, start);
            var to = GetCurrentCell(cells, destination);

            // 방문 노드 및 열린 노드
            var closed = new List<Cell>();
            var open = new List<Cell>();

            // Init
            from.parent = from;
            from.f = 0f;
            from.g = 0f;
            open.Add(from);

            // 횟수 파악
            // var nIterations = 0;
            while (open.Count > 0)
            {
                var lowScore = open.Min(node => node.f);
                var current = open.First(n => n.f.Equals(lowScore));

                open.Remove(current);
                closed.Add(current);

                var neighbors = FindNeighbors(cells, current.x, current.y);
                // nIterations++;
                foreach (var neighbor in neighbors)
                {
                    if (neighbor == to)
                    {
                        neighbor.parent = current;
                        return BuildPath(from, to);
                    }

                    if (closed.FirstOrDefault(n => n == neighbor) != null)
                        continue;

                    var g = current.g + GetHeuristic(current.position, neighbor.position);
                    var h = GetHeuristic(neighbor.position, to.position);
                    var nodeInOpen = open.FirstOrDefault(n => n == neighbor);

                    if (nodeInOpen == null)
                    {
                        neighbor.parent = current;
                        neighbor.f = g + h;
                        neighbor.g = g;
                        open.Insert(0, neighbor);
                        continue;
                    }

                    if (g + h < nodeInOpen.f)
                    {
                        nodeInOpen.f = g + h;
                        nodeInOpen.g = g;
                        neighbor.parent = current;
                    }
                }
            }

            // 성공 여부
            return null;
        }

        // 현재 위치를 받아, 밟고 있는 노드의 값을 반환한다.
        public static Cell GetCurrentCell(Cell[,] cells, Vector2 pos)
        {
            var xLen = Cell.xSize / 2;
            var yLen = Cell.ySize / 2;

            return (from Cell cell in cells
                let xMin = cell.position.x - xLen
                let xMax = cell.position.x + xLen
                let yMin = cell.position.y - yLen
                let yMax = cell.position.y + yLen
                where pos.x >= xMin && pos.x <= xMax && pos.y >= yMin && pos.y <= yMax
                select cell).FirstOrDefault();
        }

        // 휴리스틱 가중치 (대각선의 경우 예외처리)
        private static float GetHeuristic(Vector2 v1, Vector2 v2)
        {
            // 가중치 부여
            var d = Cell.xSize + Cell.ySize;
            var h = 10 * (Mathf.Abs(v1.x - v2.x) + (Mathf.Abs(v1.y - v2.y)));

            // 대각선 이동 무시
            return (d * 1.1f < h) ? Infinity : h;
        }

        // 도착점에서 시작점까지의 순서를 역으로 뒤집어 경로를 완성시킨다.
        private static Cell[] BuildPath(Cell from, Cell to)
        {
            // 타겟 노드에서부터 parent를 따라 역으로 추적한다.
            var cellList = new List<Cell>();
            var current = to;
            while (current != from)
            {
                cellList.Add(current);
                current = current.parent;
            }

            cellList.Add(from);
            cellList.Reverse();
            return cellList.ToArray();
        }

        // 벽이 없는 주위 이웃 셀들을 찾는다.
        private static IEnumerable<Cell> FindNeighbors(Cell[,] cells, int x, int y)
        {
            // 상하좌우 맵핑 (0, 1, 2, 3)
            // up
            var cellList = new List<Cell>();
            if (y + 1 < cells.GetLength(1) && !cells[x, y + 1].wallState.HasFlag(WallState.DOWN))
                cellList.Add(cells[x, y + 1]);
            // down
            if (y - 1 >= 0 && !cells[x, y - 1].wallState.HasFlag(WallState.UP))
                cellList.Add(cells[x, y - 1]);
            // left 
            if (x - 1 >= 0 && !cells[x - 1, y].wallState.HasFlag(WallState.RIGHT))
                cellList.Add(cells[x - 1, y]);
            // right
            if (x + 1 < cells.GetLength(0) && !cells[x + 1, y].wallState.HasFlag(WallState.LEFT))
                cellList.Add(cells[x + 1, y]);

            return cellList;
        }
    }
}