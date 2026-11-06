import { readPreviewTransform } from "./merchant-preview-transform";
test("validates rotation and pixel crop", () => {
  expect(readPreviewTransform(undefined)).toEqual({});
  expect(readPreviewTransform(JSON.stringify({rotate:90,crop:{x:2,y:3,width:400,height:500}}))).toEqual({rotate:90,crop:{x:2,y:3,width:400,height:500}});
});
test("refuses invalid crop geometry and unsupported keys", () => {
  for (const edit of [{rotate:45},{crop:{x:0,y:0,width:-1,height:80}},{crop:{x:0,y:0,width:2,height:3,delete:true}}, {rotate:90,public:true}]) {
    expect(() => readPreviewTransform(JSON.stringify(edit))).toThrow();
  }
  expect(() => readPreviewTransform('{')).toThrow();
});
