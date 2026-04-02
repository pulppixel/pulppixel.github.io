using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Unity.Services.Matchmaker;
using Unity.Services.Matchmaker.Models;
using NomadsPlanet.Utils;

namespace NomadsPlanet
{
    public enum MatchmakerPollingResult
    {
        Success,
        TicketCreationError,
        TicketCancellationError,
        TicketRetrievalError,
        MatchAssignmentError
    }

    public class MatchmakingResult
    {
        public string IP;
        public int Port;
        public MatchmakerPollingResult Result;
        public string ResultMessage;
    }

    public class MatchplayMatchmaker : IDisposable
    {
        private string _lastUsedTicket;
        private CancellationTokenSource _cancelToken;

        private const int TicketCooldown = 1000;

        public bool IsMatchmaking { get; private set; }

        public async Task<MatchmakingResult> Matchmake(UserData data)
        {
            _cancelToken = new CancellationTokenSource();

            string queueName = data.userGamePreferences.ToMultiplayQueue();
            CreateTicketOptions createTicketOptions = new CreateTicketOptions(queueName);
            CustomFunc.ConsoleLog(createTicketOptions.QueueName);

            List<Player> players = new List<Player>
            {
                new Player(data.userAuthId, data.userGamePreferences)
            };

            try
            {
                IsMatchmaking = true;
                CreateTicketResponse createResult = await MatchmakerService.Instance.CreateTicketAsync(players, createTicketOptions);

                _lastUsedTicket = createResult.Id;

                try
                {
                    while (!_cancelToken.IsCancellationRequested)
                    {
                        TicketStatusResponse checkTicket = await MatchmakerService.Instance.GetTicketAsync(_lastUsedTicket);

                        if (checkTicket.Type == typeof(MultiplayAssignment))
                        {
                            MultiplayAssignment matchAssignment = (MultiplayAssignment)checkTicket.Value;

                            if (matchAssignment.Status == MultiplayAssignment.StatusOptions.Found)
                            {
                                return ReturnMatchResult(MatchmakerPollingResult.Success, "", matchAssignment);
                            }

                            if (matchAssignment.Status is MultiplayAssignment.StatusOptions.Timeout or MultiplayAssignment.StatusOptions.Failed)
                            {
                                return ReturnMatchResult(MatchmakerPollingResult.MatchAssignmentError,
                                    $"Ticket: {_lastUsedTicket} - {matchAssignment.Status} - {matchAssignment.Message}",
                                    null);
                            }

                            CustomFunc.ConsoleLog($"Polled Ticket: {_lastUsedTicket} Status: {matchAssignment.Status} ");
                        }

                        await Task.Delay(TicketCooldown);
                    }
                }
                catch (MatchmakerServiceException e)
                {
                    return ReturnMatchResult(MatchmakerPollingResult.TicketRetrievalError, e.ToString(), null);
                }
            }
            catch (MatchmakerServiceException e)
            {
                return ReturnMatchResult(MatchmakerPollingResult.TicketCreationError, e.ToString(), null);
            }

            return ReturnMatchResult(MatchmakerPollingResult.TicketRetrievalError, "Cancelled Matchmaking", null);
        }

        public async Task CancelMatchmaking()
        {
            if (!IsMatchmaking)
            {
                return;
            }

            IsMatchmaking = false;

            if (_cancelToken.Token.CanBeCanceled)
            {
                _cancelToken.Cancel();
            }

            if (string.IsNullOrEmpty(_lastUsedTicket))
            {
                return;
            }

            CustomFunc.ConsoleLog($"Cancelling {_lastUsedTicket}");

            await MatchmakerService.Instance.DeleteTicketAsync(_lastUsedTicket);
        }

        private MatchmakingResult ReturnMatchResult(MatchmakerPollingResult resultErrorType, string message, MultiplayAssignment assignment)
        {
            IsMatchmaking = false;

            if (assignment != null)
            {
                string parsedIp = assignment.Ip;
                int? parsedPort = assignment.Port;
                if (parsedPort == null)
                {
                    return new MatchmakingResult
                    {
                        Result = MatchmakerPollingResult.MatchAssignmentError,
                        ResultMessage = $"Port missing? - {assignment.Port}\n-{assignment.Message}"
                    };
                }

                return new MatchmakingResult
                {
                    Result = MatchmakerPollingResult.Success,
                    IP = parsedIp,
                    Port = (int)parsedPort,
                    ResultMessage = assignment.Message
                };
            }

            return new MatchmakingResult
            {
                Result = resultErrorType,
                ResultMessage = message
            };
        }

        public void Dispose()
        {
            _ = CancelMatchmaking();

            _cancelToken?.Dispose();
        }
    }
}