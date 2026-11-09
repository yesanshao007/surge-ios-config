// Adapted from ddgksf2013/Scripts 12306.js for Surge's request-script API.
// Only the two historical splash placements are handled; all others pass through.
let result;

if ($request.method === "POST" && typeof $request.body === "string") {
  try {
    const payload = JSON.parse($request.body);
    if (payload && payload.placementNo === "0007") {
      result = {
        materialsList: [{ billMaterialsId: "6491", filePath: "ddgksf2013", creativeType: 1 }],
        advertParam: { skipTime: 1 },
        code: "00"
      };
    } else if (payload && payload.placementNo === "G0054") {
      result = { code: "00", materialsList: [{}] };
    }
  } catch (_) {
    // Unknown request bodies must not disrupt the app.
  }
}

if (result) {
  $done({
    response: {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(result)
    }
  });
} else {
  $done({});
}
