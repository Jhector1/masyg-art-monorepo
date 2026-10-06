import { GET } from "../route";
import { reviewsService } from "@acme/server/services/reviews.service";

jest.mock("@acme/server/services/reviews.service", () => ({
  reviewsService: {
    listByProduct: jest.fn(),
  },
}));

const mockListByProduct = reviewsService.listByProduct as unknown as jest.Mock;

describe("JeanYves canonical public review route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates GET to the existing product review handler", async () => {
    mockListByProduct.mockResolvedValue([{ id: "r1", rating: 5 }]);

    const response = await GET({} as any, {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(mockListByProduct).toHaveBeenCalledWith("p1");
    expect(await response.json()).toEqual([{ id: "r1", rating: 5 }]);
  });
});
