SELECT
	Asks.*,
	Bids.*,	
	ROUND( Bids.Bid - Asks.Ask , 3 ) Diff
FROM (
	SELECT
		R.Exchanges_Id,
		R.Currencies_Id,
		( R.Bid / C.Rate ) * ( 1 - X.Fee ) Bid
	FROM
		Rates R
		LEFT JOIN Currencies C ON R.Currencies_Id = C.Id
		LEFT JOIN Exchanges X ON R.Exchanges_Id = X.Id
) Bids
JOIN (
	SELECT
		R.Exchanges_Id,
		R.Currencies_Id,
		( R.Ask / C.Rate ) * ( 1 + X.Fee ) Ask
	FROM
		Rates R
		LEFT JOIN Currencies C ON R.Currencies_Id = C.Id
		LEFT JOIN Exchanges X ON R.Exchanges_Id = X.Id
) Asks
WHERE
	Asks.Ask < Bids.Bid
	